import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { selectNickname } from '@/lib/nickname/service';
import { analyzeAndLogObservations } from '@/lib/hup/analyzer';
import { analyzeAndDistillMemories } from '@/lib/memory/distiller';

// Initialize Gemini safely
const getGeminiModel = () => {
  const apiKey = serverEnv.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MOCK_KEY') return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-3.1-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7
    }
  });
};

interface ReinforcementResult {
  celebration: string;
  reasoning: string;
  encouragement: string;
  follow_up_question: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { selectedPathText } = await request.json();
    if (!selectedPathText || !selectedPathText.trim()) {
      return NextResponse.json({ error: 'selectedPathText is required.' }, { status: 400 });
    }

    // 1. Fetch active chat
    const { data: activeChat } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeChat) {
      return NextResponse.json({ error: 'No active chat session found.' }, { status: 400 });
    }

    const chatMetadata = activeChat.metadata || {};
    const possiblePaths = chatMetadata.possiblePaths || [];

    // Check if the selected path is in our possible paths
    const matchedPath = possiblePaths.find(
      (p: any) => p.text.toLowerCase() === selectedPathText.trim().toLowerCase()
    ) || { text: selectedPathText.trim(), tags: ['general'] };

    // 2. Classify category based on selected path
    let category = 'Other';
    const textLower = matchedPath.text.toLowerCase();
    if (/pizza|sushi|pasta|burger|food|eat|dinner|lunch|breakfast|restaurant/i.test(textLower)) {
      category = 'Food';
    } else if (/movie|film|netflix|show|watch|game|youtube|music|book/i.test(textLower)) {
      category = 'Entertainment';
    } else if (/run|gym|work|study|code|read|sleep|clean/i.test(textLower)) {
      category = 'Activities';
    } else if (/buy|shop|clothes|shoes|amazon|gadget/i.test(textLower)) {
      category = 'Shopping';
    }

    // 3. Resolve Nickname
    let activeNickname = 'friend';
    try {
      activeNickname = await selectNickname(user.id);
    } catch (e) {
      console.warn('Failed to load nickname:', e);
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'friend';
    const activeMascot = chatMetadata.lastMascot || 'munch';

    // 4. Generate post-decision mascot reflection (celebration -> reflection -> follow-up)
    let reinforcement: ReinforcementResult = {
      celebration: `I'm glad we figured that out together. 🌿`,
      reasoning: `Choosing "${matchedPath.text}" feels like a gentle starting point that fits your needs.`,
      encouragement: `You don't need a perfect choice.`,
      follow_up_question: `I'd love to hear how it went later. Take a breath, and go gently.`
    };

    const model = getGeminiModel();
    if (model) {
      const prompt = `
You are the mascot companion: '${activeMascot}' for ${activeNickname}.
The user has just finalized their decision in the chat and selected the path: "${matchedPath.text}".
Category: "${category}".

Please write:
1. A celebration message (validating their choice with warmth).
2. A reasoning message (gently explaining why it feels right for their energy).
3. Reassurance that they don't need a perfect choice.
4. A gentle closing follow-up question (checking in later, encouraging them).

Output MUST follow this JSON schema:
{
  "celebration": "Celebration message (1 sentence)",
  "reasoning": "Reasoning explaining why this fits (1-2 sentences)",
  "encouragement": "Reassurance message (1 sentence)",
  "follow_up_question": "Gentle closing follow-up question (1 sentence)"
}
`;

      try {
        const response = await model.generateContent(prompt);
        const text = response.response.text().trim();
        const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.celebration && parsed.reasoning) {
          reinforcement = parsed;
        }
      } catch (err) {
        console.warn('[DecideRoute] Gemini reinforcement failed, using fallback:', err);
      }
    }

    // 5. Insert decision record (backward compatibility)
    const { data: decisionRecord, error: decisionError } = await supabase
      .from('decisions')
      .insert({
        user_id: user.id,
        category: category,
        selected_option: matchedPath.text,
        reinforcement_message: `${reinforcement.celebration} ${reinforcement.reasoning} ${reinforcement.encouragement}`.trim(),
        reasoning: reinforcement.reasoning,
        encouragement: reinforcement.encouragement,
        follow_up_question: reinforcement.follow_up_question,
        mascot: activeMascot,
        nickname_snapshot: activeNickname
      })
      .select()
      .single();

    if (decisionError) {
      console.error('Failed to create decision record:', decisionError);
      return NextResponse.json({ error: 'Failed to record decision.' }, { status: 500 });
    }

    // 6. Insert options records (mapping the possible paths)
    const optionsPayload = possiblePaths.map((path: any) => ({
      decision_id: decisionRecord.id,
      option_text: path.text,
      is_selected: path.text.toLowerCase() === matchedPath.text.toLowerCase(),
      weight: 1.0,
      tags: path.tags || ['general']
    }));

    // If options payload is empty (e.g. user clicked custom path), add at least the selected option
    if (optionsPayload.length === 0) {
      optionsPayload.push({
        decision_id: decisionRecord.id,
        option_text: matchedPath.text,
        is_selected: true,
        weight: 1.0,
        tags: matchedPath.tags || ['general']
      });
    }

    const { error: optionsError } = await supabase
      .from('options')
      .insert(optionsPayload);

    if (optionsError) {
      console.error('Failed to insert options records:', optionsError);
    }

    // 7. Save mascot messages to the active chat messages
    const postDecisionMessageText = `${reinforcement.celebration}\n\n${reinforcement.reasoning}\n\n${reinforcement.encouragement}\n\n${reinforcement.follow_up_question}`;
    
    await supabase.from('chat_messages').insert({
      chat_id: activeChat.id,
      sender: 'mascot',
      content: postDecisionMessageText,
      mascot_character: activeMascot,
      mascot_expression: 'happy'
    });

    // 8. Archive active chat session
    await supabase
      .from('chats')
      .update({
        status: 'archived',
        state: 'Archived'
      })
      .eq('id', activeChat.id);

    // 9. Dispatch HUPS and Memory Candidate promotion asynchronously
    const analysisPayload = {
      selected_option: matchedPath.text,
      category,
      options: possiblePaths.map((p: any) => p.text),
      mascot: activeMascot
    };

    analyzeAndLogObservations(user.id, 'decision', decisionRecord.id, analysisPayload)
      .catch(err => console.error('HUPS observation logging failed:', err));

    analyzeAndDistillMemories(user.id, 'decision', decisionRecord.id, analysisPayload)
      .catch(err => console.error('Memory distillation failed:', err));

    // Queue summary candidates for Memory Promotion Pipeline
    await supabase.from('memory_candidates').insert({
      user_id: user.id,
      summary: `User decided to explore the path: "${matchedPath.text}" under category ${category}.`,
      status: 'pending'
    });

    return NextResponse.json({
      success: true,
      decision: decisionRecord,
      reinforcement
    });
  } catch (error: any) {
    console.error('POST /api/chat/decide failed:', error);
    return NextResponse.json({ error: error.message || 'Server error.' }, { status: 500 });
  }
}
