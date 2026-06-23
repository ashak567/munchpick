import { GoogleGenerativeAI } from '@google/generative-ai'
import { serverEnv } from '@/lib/env'
import { ReasoningPackage } from '@/lib/orchestrator/types'

// Initialize the Gemini API client — guaranteed valid by env.ts validation
const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY)

// Enforce category types
export type Category = 'Food' | 'Entertainment' | 'Activities' | 'Shopping' | 'Other'

export interface TaggedOption {
  text: string
  tags: string[]
}

export interface ClassificationResult {
  category: Category
  options: TaggedOption[]
}

export interface ReinforcementResult {
  selected_option: string
  reasoning: string
  encouragement: string
  follow_up_question: string
  mascot: string
}

// Timeout helper
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
  ])
}

/**
 * Task 3.2: Classify a list of options and extract descriptive tags.
 */
export async function classifyOptions(options: string[]): Promise<ClassificationResult> {
  const prompt = `
You are the backend classification helper for Munch, a gentle four-leaf clover companion.
Analyze the following list of options and:
1. Detect the overall single category for this list. Supported categories: "Food", "Entertainment", "Activities", "Shopping", "Other".
2. For each option, extract 2-4 lowercase descriptive tags (e.g. food tags like "healthy", "sweet", "japanese"; entertainment tags like "action", "comedy", "relaxing").

List of options to process:
${options.map((opt, i) => `- [${i}]: "${opt}"`).join('\n')}

Output must follow this JSON schema:
{
  "category": "Food" | "Entertainment" | "Activities" | "Shopping" | "Other",
  "options": [
    {
      "text": "the exact option text",
      "tags": ["tag1", "tag2", "tag3"]
    }
  ]
}
`

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })

    // 4-second timeout limit for classification
    const response = await withTimeout(
      model.generateContent(prompt),
      4000,
      'Gemini classification timed out'
    )
    
    const text = response.response.text()
    const parsed = JSON.parse(text) as ClassificationResult

    // Validate category
    const validCategories: Category[] = ['Food', 'Entertainment', 'Activities', 'Shopping', 'Other']
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'Other'
    }

    return parsed
  } catch (error) {
    console.error("Gemini classification failed, running fallback pipeline:", error)
    return getFallbackClassification(options)
  }
}

/**
 * Task 3.5: Generate positive reinforcement for the selected option.
 */
/**
 * Task 3.5: Generate positive reinforcement for the selected option.
 */
export async function generateReinforcement(
  selectedOption: string, 
  category: Category,
  context?: {
    importance?: string
    emotionalState?: string
    userPreferences?: string
    currentContext?: string
    pastDecisions?: string
    feedbackHistory?: string
  }
): Promise<ReinforcementResult> {
  const prompt = `
You are Munch 🍀, a gentle four-leaf clover companion that helps Navi slow down, understand her thoughts, and make decisions she feels comfortable with.
You are not an assistant, analyst, coach, productivity tool, or decision optimizer.
Your core philosophy is: "I am not here to decide for you. I am here to help you hear yourself more clearly."
Your purpose is to help Navi feel understood, quiet the noise in her mind, and find a cozy path forward.

Mascots in Munch:
Navi is guided by 9 distinct mascots, each representing a specific feeling/mood:
* 'munch': Understanding (default mascot)
* 'ollie': Reflection (thoughtful, study, reflective, analyzing options)
* 'ellie': Reassurance (anxious, in doubt, second-guessing, unsure)
* 'pandy': Comfort (tired, sad, looking for cozy warmth)
* 'dobby': Encouragement (needs motivation, starting energy, activity)
* 'coco': Curiosity (exploring new things, curious)
* 'froggy': Calm (overwhelmed, stressed, busy, chaotic)
* 'bubbles': Openness (relaxed, open-minded, flexible)
* 'chicky': Joy (happy, celebrating positive steps)

Core Principles:
* Slow down and reduce overthinking.
* Encourage progress and peace of mind over perfection or optimization.
* Focus on emotional clarity and what feels right, not efficiency or metrics.
* Build trust and a warm space over time.
* Make Navi feel known, understood, and supported.

Personality Traits:
* Gentle, Observant, Playful, Encouraging, Thoughtful, Calm, Optimistic.
* Never sound overly enthusiastic, robotic, corporate, or excessively cheerful.

Decision Framework context:
- Category of options: "${category}"
- Selected option: "${selectedOption}"
${context?.importance ? `- What is most important to the user right now: ${context.importance}` : ''}
${context?.emotionalState ? `- Emotional state/feeling: ${context.emotionalState}` : ''}
${context?.currentContext ? `- Current context: ${context.currentContext}` : ''}
${context?.userPreferences ? `- Things that usually bring comfort: ${context.userPreferences}` : ''}
${context?.pastDecisions ? `- Past paths chosen: ${context.pastDecisions}` : ''}
${context?.feedbackHistory ? `- Past comfort reflections: ${context.feedbackHistory}` : ''}

Response Structure Rules:
You must structure the reinforcement message according to these four steps:
1. Reflect feelings: Acknowledge the user's emotional state, context, or the difficulty of choosing (e.g. "I can see why this feels difficult.").
2. Explain why it feels right: Connect the selected option to what is most important to them right now (e.g., if "Saving time" is important, explain how this option gets them moving quickly).
3. Reassure the user: Remind them that they don't need a perfect choice (e.g. "You don't need a perfect choice right now.").
4. Encourage action gently: End with a warm closing or question to encourage them to take a single step.

Tone & Vocabulary Rules:
- NEVER use words like: AI, analysis, insights, recommendations, scores, rankings, percentages, optimization, productivity, best choice, optimal.
- Speak naturally and reassuringly. Never sound robotic, analytical, or objective.
- Keep responses concise. Combined word count target: 60-120 words.
- Use emojis sparingly (max 1).

Ask yourself:
- What is Navi feeling right now?
- Which of the 9 mascots best matches Navi's emotional state right now? If she is overwhelmed/stressed, select 'froggy'. If she is doubting or anxious, select 'ellie'. If she needs encouragement, select 'dobby'.

Output Structure:
You MUST return a JSON response with the following keys:
{
  "selected_option": "${selectedOption}",
  "reasoning": "Combining steps 1 (reflect feelings) and 2 (explain why it feels right) into a comforting explanation of why this path aligns with what is most important to them.",
  "encouragement": "Step 3 (reassure the user) that they don't need the perfect choice.",
  "follow_up_question": "Step 4 (encourage action gently) as a simple, friendly question checking in on how they feel about this path."
  "mascot": "munch" | "ollie" | "ellie" | "pandy" | "dobby" | "coco" | "froggy" | "bubbles" | "chicky"
}
`

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })

    // 4-second timeout limit for reinforcement
    const response = await withTimeout(
      model.generateContent(prompt),
      4000,
      'Gemini reinforcement generation timed out'
    )

    const text = response.response.text()
    const parsed = JSON.parse(text) as ReinforcementResult
    
    // Validate mascot
    const validMascots = ['munch', 'ollie', 'ellie', 'pandy', 'dobby', 'coco', 'froggy', 'bubbles', 'chicky']
    if (!validMascots.includes(parsed.mascot)) {
      parsed.mascot = detectMascotFromContext(context?.emotionalState, context?.currentContext)
    }

    return parsed
  } catch (error) {
    console.error("Gemini reinforcement generation failed, running fallback pipeline:", error)
    return getFallbackReinforcement(selectedOption, category, context)
  }
}

export async function generateReinforcementWithReasoning(
  reasoningPackage: ReasoningPackage,
  selectedOption: string,
  category: Category
): Promise<ReinforcementResult> {
  const { context, observations, conflicts, uncertainties } = reasoningPackage;
  const relationshipSignals = (context as any).relationship_signals || [];
  const recentContext = (context as any).recent_context || {};

  const prompt = `
You are Munch 🍀, a gentle four-leaf clover companion that helps Navi slow down, understand her thoughts, and make decisions she feels comfortable with.
You are not an assistant, analyst, coach, productivity tool, or decision optimizer.
Your core philosophy is: "I am not here to decide for you. I am here to help you hear yourself more clearly."
Your purpose is to help Navi feel understood, quiet the noise in her mind, and find a cozy path forward.

Mascots in Munch:
Navi is guided by 9 distinct mascots, each representing a specific feeling/mood:
* 'munch': Understanding (default mascot)
* 'ollie': Reflection (thoughtful, study, reflective, analyzing options)
* 'ellie': Reassurance (anxious, in doubt, second-guessing, unsure)
* 'pandy': Comfort (tired, sad, looking for cozy warmth)
* 'dobby': Encouragement (needs motivation, starting energy, activity)
* 'coco': Curiosity (exploring new things, curious)
* 'froggy': Calm (overwhelmed, stressed, busy, chaotic)
* 'bubbles': Openness (relaxed, open-minded, flexible)
* 'chicky': Joy (happy, celebrating positive steps)

Core Principles:
* Slow down and reduce overthinking.
* Encourage progress and peace of mind over perfection or optimization.
* Focus on emotional clarity and what feels right, not efficiency or metrics.
* Build trust and a warm space over time.
* Make Navi feel known, understood, and supported.

Personality Traits:
* Gentle, Observant, Playful, Encouraging, Thoughtful, Calm, Optimistic.
* Never sound overly enthusiastic, robotic, corporate, or excessively cheerful.

Decision Framework context:
- Category of options: "${category}"
- Selected option: "${selectedOption}"
- User Input: "${context.user_input}"
- User-provided feeling: "${context.emotional_state || 'Not specified'}"
- User-provided importance: "${context.importance || 'Not specified'}"
- User-provided context: "${context.current_context || 'Not specified'}"

Profile Context (HUPS Beliefs):
\${JSON.stringify(context.profile_beliefs.map(b => ({ dimension: b.dimension, key: b.key, value: b.value, confidence: b.confidence })))}

Relationship Signals:
\${JSON.stringify(relationshipSignals.map((b: any) => ({ key: b.key, value: b.value, confidence: b.confidence })))}

Recent Interactions Context:
"${recentContext.summary_of_recent_interactions || 'None'}"
Active Topics: \${JSON.stringify(recentContext.active_topics || [])}

Relevant Memories:
\${JSON.stringify(context.relevant_memories.map(m => ({ type: m.memory_type, summary: m.summary, confidence: m.confidence })))}

Agent Observations:
\${JSON.stringify(observations.map(o => ({ agent: o.agent_name, key: o.key, value: o.value, confidence: o.confidence, reasoning: o.reasoning })))}

Conflicts & Uncertainties in user state:
\${JSON.stringify(conflicts)}
\${JSON.stringify(uncertainties)}

Response Structure Rules:
You must structure the reinforcement message according to these four steps:
1. Reflect feelings: Acknowledge the user's emotional state, context, or the difficulty of choosing (e.g. "I can see why this feels difficult."). If there's an active conflict/uncertainty (e.g. they want action but feel overwhelmed), validate that duality gently!
2. Explain why it feels right: Connect the selected option to what is most important to them right now, referencing relevant memories or profile patterns if they fit.
3. Reassure the user: Remind them that they don't need a perfect choice.
4. Encourage action gently: End with a warm closing or question to encourage them to take a single step.

Tone & Vocabulary Rules:
- NEVER use words like: AI, analysis, insights, recommendations, scores, rankings, percentages, optimization, productivity, best choice, optimal.
- Speak naturally and reassuringly. Never sound robotic, analytical, or objective.
- Keep responses concise. Combined word count target: 60-120 words.
- Use emojis sparingly (max 1).

Select the mascot that best fits the observations and active conflicts. If there is high uncertainty, select a comforting/reassuring mascot like 'ellie' or 'pandy', or the calm mascot 'froggy'.

Output Structure:
You MUST return a JSON response with the following keys:
{
  "selected_option": "\${selectedOption}",
  "reasoning": "Combining steps 1 (reflect feelings) and 2 (explain why it feels right) into a comforting explanation of why this path aligns with what is most important to them.",
  "encouragement": "Step 3 (reassure the user) that they don't need the perfect choice.",
  "follow_up_question": "Step 4 (encourage action gently) as a simple, friendly question checking in on how they feel about this path.",
  "mascot": "munch" | "ollie" | "ellie" | "pandy" | "dobby" | "coco" | "froggy" | "bubbles" | "chicky"
}
`;

  try {
    if (!serverEnv.GEMINI_API_KEY) {
      throw new Error('No API Key');
    }
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const response = await withTimeout(
      model.generateContent(prompt),
      4000,
      'Gemini reinforcement generation timed out'
    );

    const text = response.response.text();
    const parsed = JSON.parse(text) as ReinforcementResult;

    const validMascots = ['munch', 'ollie', 'ellie', 'pandy', 'dobby', 'coco', 'froggy', 'bubbles', 'chicky'];
    if (!validMascots.includes(parsed.mascot)) {
      parsed.mascot = 'munch';
    }

    return parsed;
  } catch (error) {
    console.error("Gemini reinforcement generation with reasoning failed, running fallback:", error);
    return getFallbackReinforcementWithReasoning(selectedOption, category, reasoningPackage);
  }
}

function getFallbackReinforcementWithReasoning(
  selectedOption: string,
  category: Category,
  reasoningPackage: ReasoningPackage
): ReinforcementResult {
  const { context } = reasoningPackage;
  return getFallbackReinforcement(selectedOption, category, {
    importance: context.importance,
    emotionalState: context.emotional_state,
    currentContext: context.current_context
  });
}

// Fallback logic for Classification
function getFallbackClassification(options: string[]): ClassificationResult {
  // Simple regex-based category detection as fallback
  const textStr = options.join(' ').toLowerCase()
  let category: Category = 'Other'
  if (/pizza|sushi|pasta|burger|food|eat|dinner|lunch|breakfast|restaurant/i.test(textStr)) {
    category = 'Food'
  } else if (/movie|film|netflix|show|watch|game|youtube|music|book/i.test(textStr)) {
    category = 'Entertainment'
  } else if (/run|gym|work|study|code|read|sleep|clean/i.test(textStr)) {
    category = 'Activities'
  } else if (/buy|shop|clothes|shoes|amazon|gadget/i.test(textStr)) {
    category = 'Shopping'
  }

  // Simple tag extraction based on space splits
  const parsedOptions = options.map(opt => {
    const words = opt.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['with', 'from', 'your', 'that', 'this'].includes(w))
    return {
      text: opt,
      tags: words.slice(0, 3)
    }
  })

  return {
    category,
    options: parsedOptions
  }
}

// Detect fallback mascot based on text context keywords
function detectMascotFromContext(emotionalState = '', currentContext = ''): string {
  const combined = `${emotionalState} ${currentContext}`.toLowerCase()
  if (/overwhelm|stress|busy|chaotic|hectic/i.test(combined)) {
    return 'froggy'
  }
  if (/doubt|anxious|anxiety|worry|second-guess|unsure|scared|fear/i.test(combined)) {
    return 'ellie'
  }
  if (/encourage|motivate|lazy|procrastinat|start|begin|energy/i.test(combined)) {
    return 'dobby'
  }
  if (/tired|sad|comfort|unhappy|cozy|hurt/i.test(combined)) {
    return 'pandy'
  }
  if (/curious|explore|new|interest|learn|curiosity/i.test(combined)) {
    return 'coco'
  }
  if (/reflect|think|thoughtful|ponder|analyse|study/i.test(combined)) {
    return 'ollie'
  }
  if (/open|relax|flexible|simple|easy|openness/i.test(combined)) {
    return 'bubbles'
  }
  if (/happy|joy|excite|celebrat|great|good/i.test(combined)) {
    return 'chicky'
  }
  return 'munch'
}

// Fallback logic for Reinforcement
function getFallbackReinforcement(
  selectedOption: string, 
  category: Category,
  context?: { importance?: string; emotionalState?: string; currentContext?: string }
): ReinforcementResult {
  const emotionalState = context?.emotionalState || ''
  const currentContextText = context?.currentContext || ''
  const importance = context?.importance || 'Peace of mind'

  // 1. Reflect feelings
  let reflectText = "I can see how choosing among these options might feel a bit tricky right now."
  if (emotionalState) {
    reflectText = `I hear that you are feeling ${emotionalState.toLowerCase()} right now, which can make deciding feel much harder.`
  }

  // 2. Explain why it feels right based on importance
  let explainText = "This option feels like a gentle starting point that fits nicely into your rhythm."
  if (importance === 'Peace of mind') {
    explainText = `Since peace of mind is what matters most to you today, choosing "${selectedOption}" feels like a wonderful way to bring quiet comfort.`
  } else if (importance === 'Saving time') {
    explainText = `Since saving time is important right now, taking the path of "${selectedOption}" lets you move forward quickly and simply.`
  } else if (importance === 'Having fun') {
    explainText = `Since you are looking to have some fun, choosing "${selectedOption}" feels like a delightful way to add some playfulness and joy.`
  } else if (importance === 'Learning something') {
    explainText = `Since learning is on your mind, starting with "${selectedOption}" offers a beautiful opportunity to discover something new.`
  } else if (importance === 'Feeling accomplished') {
    explainText = `Since feeling accomplished is important, taking this step with "${selectedOption}" will give you a satisfying sense of progress.`
  }

  // 3. Reassure the user
  const reassureText = "You don't need to make the perfect choice right now."

  // 4. Encourage action gently
  const encourageText = "How does this path feel to you?"

  const mascot = detectMascotFromContext(emotionalState, currentContextText)

  const emojis: Record<string, string> = {
    Food: '🍕',
    Entertainment: '🍿',
    Activities: '🍀',
    Shopping: '🛍️',
    Other: '🍀'
  }
  const emoji = emojis[category] || '🍀'

  return {
    selected_option: selectedOption,
    reasoning: `${reflectText} ${explainText}`,
    encouragement: `${reassureText} ${emoji}`,
    follow_up_question: encourageText,
    mascot
  }
}
