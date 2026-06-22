import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize the Gemini API client
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined in environment variables. Fallbacks will be active.")
    return null
  }
  return new GoogleGenerativeAI(apiKey)
}

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
  const genAI = getGenAI()
  if (!genAI) {
    return getFallbackClassification(options)
  }

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
      model: 'gemini-1.5-flash',
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
export async function generateReinforcement(
  selectedOption: string, 
  category: Category,
  context?: {
    emotionalState?: string
    userPreferences?: string
    currentContext?: string
    pastDecisions?: string
    feedbackHistory?: string
  }
): Promise<ReinforcementResult> {
  const genAI = getGenAI()
  if (!genAI) {
    return getFallbackReinforcement(selectedOption, category, context)
  }

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
${context?.emotionalState ? `- Emotional state/feeling: ${context.emotionalState}` : ''}
${context?.currentContext ? `- Current context: ${context.currentContext}` : ''}
${context?.userPreferences ? `- Things that usually bring comfort: ${context.userPreferences}` : ''}
${context?.pastDecisions ? `- Past paths chosen: ${context.pastDecisions}` : ''}
${context?.feedbackHistory ? `- Past comfort reflections: ${context.feedbackHistory}` : ''}

Ask yourself:
- What is Navi feeling right now?
- Which path aligns with what brings her comfort?
- Which path reduces friction and quietens the mind?
- Which option feels like a gentle starting point?
- Which of the 9 mascots best matches Navi's emotional state right now? If she is overwhelmed/stressed, select 'froggy'. If she is doubting or anxious, select 'ellie'. If she needs encouragement, select 'dobby'.

Response Rules:
- NEVER use words like: AI, analysis, insights, recommendations, scores, optimization, productivity, best choice, optimal.
- Use words like: thoughts, feelings, reflections, what matters to you, what feels right, let's figure it out together.
- Speak naturally and reassuringly. Never sound robotic or corporate.

Tone Guidelines:
- Keep responses concise.
- Target word count for reasoning + encouragement + follow_up_question combined: 60–120 words.
- Use simple language.
- Use emojis sparingly. Maximum: one emoji per response.
- Cute means warm, not immature. Never sound childish.

Output Structure:
You MUST return a JSON response with the following keys:
{
  "selected_option": "${selectedOption}",
  "reasoning": "A warm, natural explanation of why this choice feels right for Navi, focusing on comfort, quietness of mind, or ease of starting.",
  "encouragement": "A gentle, supportive closing line to help her feel at peace.",
  "follow_up_question": "A simple, friendly question checking in on how she feels about this path.",
  "mascot": "munch" | "ollie" | "ellie" | "pandy" | "dobby" | "coco" | "froggy" | "bubbles" | "chicky"
}
`

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
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
  if (/overwhelm|stress|busy|chaotic|hectic|tired|exhaust/i.test(combined)) {
    return 'froggy'
  }
  if (/doubt|anxious|anxiety|worry|second-guess|unsure|scared|fear/i.test(combined)) {
    return 'ellie'
  }
  if (/encourage|motivate|lazy|procrastinat|start|begin|work|study/i.test(combined)) {
    return 'dobby'
  }
  if (/tired|sad|comfort|unhappy|cozy|hurt/i.test(combined)) {
    return 'pandy'
  }
  if (/curious|explore|new|interest|learn/i.test(combined)) {
    return 'coco'
  }
  if (/reflect|think|thoughtful|ponder/i.test(combined)) {
    return 'ollie'
  }
  if (/open|relax|flexible|simple|easy/i.test(combined)) {
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
  context?: { emotionalState?: string; currentContext?: string }
): ReinforcementResult {
  const genericReasons: Record<Category, { reasoning: string; encouragement: string; follow_up_question: string }> = {
    Food: {
      reasoning: "Taking a moment for a cozy meal feels like a beautiful way to care for yourself today. We don't need to hurry or stress—just enjoying something warm is a wonderful place to start.",
      encouragement: "Let's take a breath and enjoy this. 🍕",
      follow_up_question: "Does this sound comforting to you?"
    },
    Entertainment: {
      reasoning: "This feels like a lovely, peaceful way to spend some quality time. It asks nothing of you right now, allowing you to just sit back and quiet your thoughts.",
      encouragement: "I hope this brings a little smile to your day. 🍿",
      follow_up_question: "Does this feel like a cozy way to spend your evening?"
    },
    Activities: {
      reasoning: "Let's take a single, gentle step together. We don't need to finish everything or make it perfect—simply beginning will help clear the noise.",
      encouragement: "You don't have to carry the whole mountain today—just one step. 🍀",
      follow_up_question: "Would you like to try starting this with me?"
    },
    Shopping: {
      reasoning: "This option feels like something that fits nicely into your space and brings a touch of comfort to your day without any second-guessing.",
      encouragement: "A little comfort is a beautiful thing. 🛍️",
      follow_up_question: "Does this choice bring you peace of mind?"
    },
    Other: {
      reasoning: "We don't need the perfect answer—just a good place to begin. This path feels gentle and asks very little of you right now.",
      encouragement: "Let's trust how you feel—it's going to be just fine. 🍀",
      follow_up_question: "Does this choice feel right to you?"
    }
  }

  const fallback = genericReasons[category] || genericReasons.Other
  const mascot = detectMascotFromContext(context?.emotionalState, context?.currentContext)

  return {
    selected_option: selectedOption,
    reasoning: fallback.reasoning,
    encouragement: fallback.encouragement,
    follow_up_question: fallback.follow_up_question,
    mascot
  }
}
