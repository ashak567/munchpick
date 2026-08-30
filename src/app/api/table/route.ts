import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_TABLE_CHARACTERS,
  generateSocialReactions,
  planGroupDiscussionTurns,
  TableMessage,
  TableEventType,
  PlannedCharacterTurn
} from '@/lib/table/group-events';
import { MASCOT_SELF_IDENTITIES } from '@/lib/mascots/self-identity';
import { MascotCharacter } from '@/lib/mascots/registry';
import {
  CognitiveTrace,
  ContextPackage,
  CognitiveEngine
} from '@/lib/reflection/types';
import {
  PersonalityEngine,
  ContextAssemblyEngine,
  PromptBuilderEngine,
  runCognitivePipeline
} from '@/lib/reflection/engine';
import { LLMGateway } from '@/lib/llm/gateway';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userMessage, history = [], currentTopic = 'Group Discussion' } = body;

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json({ error: 'User message is required' }, { status: 400 });
    }

    // 1. Execute Structured Participation & Interruption Planner
    const plannedTurns = planGroupDiscussionTurns(userMessage, history);
    const messagesToReturn: TableMessage[] = [];
    const turnHistoryAccumulator: Array<{ role: string; content: string }> = [
      ...history.map((m: any) => ({
        role: m.senderId === 'user' ? 'user' : 'assistant',
        content: m.senderName ? `${m.senderName}: ${m.content}` : m.content
      })),
      { role: 'user', content: userMessage }
    ];

    // 2. Sequentially execute planned turns (Max 3-4 turns to respect token/cost budget)
    const activeTurnsToRun = plannedTurns.slice(0, 3); // Strictly 1-3 generations per user turn

    for (let i = 0; i < activeTurnsToRun.length; i++) {
      const turn: PlannedCharacterTurn = activeTurnsToRun[i];
      const charId = turn.characterId;
      const identity = MASCOT_SELF_IDENTITIES[charId];

      // Formulate contextual input for cognitive pipeline
      let contextualInput = userMessage;

      if (i > 0) {
        const priorMsg = messagesToReturn[i - 1];
        const priorSpeakerName = priorMsg.senderName;
        const targetDesc =
          turn.targetCharacterId && turn.targetCharacterId !== 'user'
            ? MASCOT_SELF_IDENTITIES[turn.targetCharacterId as MascotCharacter]?.displayName
            : priorSpeakerName;

        if (turn.isInterruption) {
          contextualInput = `[URGENT INTERRUPTION] You are interrupting ${targetDesc} mid-thought. They just said: "${priorMsg.content}". User said: "${userMessage}". ${turn.promptGuidance} Jump in with authentic urgency, high energy, or counter-perspective in your first-person voice.`;
        } else if (turn.intent === 'playful_roast' || turn.intent === 'playful_tease') {
          contextualInput = `[PLAYFUL BANTER] ${targetDesc} just said: "${priorMsg.content}". ${turn.promptGuidance} Playfully tease or banter with them in good humor while addressing the user's situation.`;
        } else if (turn.intent === 'disagree_reframe') {
          contextualInput = `[DISAGREE & REFRAME] ${targetDesc} just said: "${priorMsg.content}". ${turn.promptGuidance} Disagree or challenge their assumption from your perspective.`;
        } else if (turn.intent === 'conclude_settle') {
          contextualInput = `[SETTLE CIRCLE] Settle the debate between the other companions, bring grounding clarity, and ask the user how they want to proceed.`;
        } else {
          contextualInput = `[BUILD UPON] ${targetDesc} just said: "${priorMsg.content}". ${turn.promptGuidance} Build upon their thought with your own distinct perspective.`;
        }
      }

      // Run Cognitive Pipeline using existing provider fallback (Gemini -> Groq -> OpenRouter)
      const pipeline: CognitiveEngine[] = [
        new PersonalityEngine(),
        new ContextAssemblyEngine(),
        new PromptBuilderEngine()
      ];

      const initialTrace: CognitiveTrace = {
        state: 'Listening',
        emotions: ['curiosity'],
        reflections: [],
        readinessScore: 0.8,
        readinessThreshold: 0.7,
        mascotCharacter: charId,
        mascotExpression: 'curious',
        mascotReason: identity.speakingStyle,
        generatedPaths: [],
        confidence: 0.9,
        activeTopicKey: 'table_discussion',
        mascotDecision: {
          mascotId: charId,
          identity: identity.personality,
          behavior: identity.speakingStyle,
          speakingStyle: identity.speakingStyle,
          emotionalStyle: identity.personality,
          interactionStyle: identity.conversationalRole
        }
      };

      const context: ContextPackage = {
        user_id: 'table_session',
        user_input: contextualInput,
        options: [],
        profile_beliefs: [],
        relevant_memories: [],
        decision_history: [],
        conversation_history: turnHistoryAccumulator,
        active_mascot: charId
      };

      let responseText = identity.voice.firstTurnStyleAnchor;

      try {
        const finalTrace = await runCognitivePipeline(pipeline, initialTrace, context);
        if (finalTrace.promptPackage) {
          const gateway = new LLMGateway();
          const gatewayRes = await gateway.generate({
            promptPackage: finalTrace.promptPackage
          });
          if (gatewayRes && gatewayRes.text) {
            responseText = gatewayRes.text.trim();
          }
        }
      } catch (genErr) {
        console.warn(`[TableAPI] Generation fallback for ${charId}:`, genErr);
      }

      // If this turn is an interruption, adjust prior message with yielding em-dash
      if (turn.isInterruption && i > 0 && messagesToReturn.length > 0) {
        const prev = messagesToReturn[messagesToReturn.length - 1];
        if (!prev.content.endsWith('—') && !prev.content.endsWith('...')) {
          prev.content = `${prev.content.replace(/[.!?]+$/, '')}—`;
        }
      }

      // Map TurnIntent to First-Class TableEventType
      let eventType: TableEventType = 'CHARACTER_SPEAK';
      if (turn.isInterruption) {
        eventType = 'CHARACTER_INTERRUPT';
      } else if (turn.intent === 'playful_tease') {
        eventType = 'CHARACTER_TEASE';
      } else if (turn.intent === 'playful_roast') {
        eventType = 'CHARACTER_ROAST';
      } else if (turn.intent === 'disagree_reframe') {
        eventType = 'CHARACTER_DISAGREE';
      } else if (turn.intent === 'agree_build') {
        eventType = 'CHARACTER_AGREE';
      } else if (turn.intent === 'conclude_settle') {
        eventType = 'DISCUSSION_END';
      }

      const messageObj: TableMessage = {
        id: `msg-${Date.now()}-${i}`,
        senderId: charId,
        senderName: identity.displayName,
        content: responseText,
        eventType,
        intent: turn.intent,
        targetSpeakerId: turn.targetCharacterId,
        interruptedSpeakerId:
          turn.isInterruption && i > 0
            ? (messagesToReturn[i - 1].senderId as MascotCharacter)
            : undefined,
        reactions: generateSocialReactions(charId, responseText, turn.intent),
        timestamp: Date.now() + i * 900
      };

      messagesToReturn.push(messageObj);

      // Accumulate for multi-character conversational context
      turnHistoryAccumulator.push({
        role: 'assistant',
        content: `${identity.displayName}: ${responseText}`
      });
    }

    return NextResponse.json({
      success: true,
      messages: messagesToReturn
    });
  } catch (err: any) {
    console.error('Table API Error:', err);
    return NextResponse.json(
      { error: 'Failed to process table discussion', details: err?.message },
      { status: 500 }
    );
  }
}
