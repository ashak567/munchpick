import * as crypto from 'crypto'
import { LLMGateway } from '@/lib/llm/gateway'
import { PromptPackage, PromptSection } from '@/lib/reflection/types'
import { ReasoningPackage } from '@/lib/orchestrator/types'

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

/**
 * Builds a deterministic PromptPackage conforming to LLMGateway validation constraints.
 */
function buildPromptPackage(sections: PromptSection[]): PromptPackage {
  sections.sort((a, b) => b.priority - a.priority)
  const rawString = sections
    .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
    .join('|')
  const checksum = crypto.createHash('sha256').update(rawString).digest('hex')
  const totalChars = sections.reduce((acc, s) => {
    const contentStr = typeof s.content === 'string' ? s.content : JSON.stringify(s.content)
    return acc + contentStr.length
  }, 0)
  const estimatedTokens = Math.ceil(totalChars / 4)

  return {
    version: 'v1.7.0',
    templateVersion: 'v1.0.0',
    sections,
    estimatedTokens,
    providerHints: { supportsStreaming: true, supportsVision: false, supportsReasoning: false },
    checksum,
    directives: { mustDo: [], shouldDo: [], avoid: [] },
    statistics: { sections: sections.length, estimatedTokens, checksum, compressionRatio: 1.0 },
    renderStrategy: 'conversation'
  }
}

/**
 * Strips markdown code fences (```json ... ```) and parses the response into JSON.
 */
function parseJsonResponse<T>(rawText: string): T {
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()
  return JSON.parse(cleaned) as T
}

/**
 * Classify a list of options and extract descriptive tags via LLMGateway.
 * Throws GatewayError or SyntaxError on failure (no silent synthetic fallbacks).
 */
export async function classifyOptions(options: string[]): Promise<ClassificationResult> {
  const gateway = new LLMGateway()
  const pkg = buildPromptPackage([
    {
      id: 'system_guidelines',
      type: 'system',
      priority: 1.0,
      required: true,
      content: 'You are the backend classification helper for Munch, a gentle four-leaf clover companion.'
    },
    {
      id: 'mascot_identity_munch',
      type: 'identity',
      priority: 0.9,
      required: true,
      content: { mascotId: 'munch', identity: 'Classifier' }
    },
    {
      id: 'personality_guidelines',
      type: 'personality',
      priority: 0.8,
      required: true,
      content: { dominantTrait: 'calm', communicationStyle: 'gentle' }
    },
    {
      id: 'conversation_history',
      type: 'conversation',
      priority: 0.4,
      required: true,
      content: `List of options to process:\n${options.map((opt, i) => `- [${i}]: "${opt}"`).join('\n')}`
    },
    {
      id: 'response_plan',
      type: 'response_plan',
      priority: 0.3,
      required: true,
      content: {
        task: 'Detect single category ("Food", "Entertainment", "Activities", "Shopping", "Other") and extract 2-4 lowercase descriptive tags per option.',
        schema: {
          category: 'Food | Entertainment | Activities | Shopping | Other',
          options: [{ text: 'the exact option text', tags: ['tag1', 'tag2'] }]
        }
      }
    },
    {
      id: 'output_instructions',
      type: 'instructions',
      priority: 0.2,
      required: true,
      content: 'Output strictly JSON matching the schema with category and options array. Do not include markdown code block formatting.'
    }
  ])

  const result = await gateway.generate({ promptPackage: pkg, maxTokens: 400 })
  const parsed = parseJsonResponse<ClassificationResult>(result.text)

  const validCategories: Category[] = ['Food', 'Entertainment', 'Activities', 'Shopping', 'Other']
  if (!validCategories.includes(parsed.category)) {
    parsed.category = 'Other'
  }
  return parsed
}

/**
 * Generate positive reinforcement for the selected option via LLMGateway.
 * Throws GatewayError or SyntaxError on failure (no silent synthetic fallbacks).
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
    userNickname?: string
    userName?: string
  }
): Promise<ReinforcementResult> {
  const nickname = context?.userNickname || context?.userName || 'friend'
  const gateway = new LLMGateway()

  const pkg = buildPromptPackage([
    {
      id: 'system_guidelines',
      type: 'system',
      priority: 1.0,
      required: true,
      content: `You are Munch 🍀, a gentle four-leaf clover companion that helps ${nickname} slow down, understand their thoughts, and make decisions they feel comfortable with.`
    },
    {
      id: 'mascot_identity_munch',
      type: 'identity',
      priority: 0.9,
      required: true,
      content: {
        mascotId: 'munch',
        identity: 'Companion',
        mascots: 'munch (Understanding), ollie (Reflection), ellie (Reassurance), pandy (Comfort), dobby (Encouragement), coco (Curiosity), froggy (Calm), bubbles (Openness), chicky (Joy)'
      }
    },
    {
      id: 'personality_guidelines',
      type: 'personality',
      priority: 0.8,
      required: true,
      content: {
        dominantTrait: 'empathetic',
        communicationStyle: 'gentle',
        traits: 'Gentle, Observant, Playful, Encouraging, Thoughtful, Calm, Optimistic. Never sound robotic or analytical.'
      }
    },
    {
      id: 'conversation_history',
      type: 'conversation',
      priority: 0.4,
      required: true,
      content: {
        category,
        selectedOption,
        importance: context?.importance,
        emotionalState: context?.emotionalState,
        currentContext: context?.currentContext,
        userPreferences: context?.userPreferences,
        pastDecisions: context?.pastDecisions,
        feedbackHistory: context?.feedbackHistory
      }
    },
    {
      id: 'response_plan',
      type: 'response_plan',
      priority: 0.3,
      required: true,
      content: {
        steps: [
          '1. Reflect feelings: Acknowledge emotional state or difficulty of choosing.',
          '2. Explain why it feels right: Connect selected option to what matters most.',
          '3. Reassure user: Remind them they do not need a perfect choice.',
          '4. Encourage action gently: Simple friendly check-in question.'
        ],
        constraints: 'Target 60-120 words. Max 1 emoji. No analytical jargon.'
      }
    },
    {
      id: 'output_instructions',
      type: 'instructions',
      priority: 0.2,
      required: true,
      content: 'Output strictly JSON with keys: "selected_option", "reasoning", "encouragement", "follow_up_question", "mascot".'
    }
  ])

  const result = await gateway.generate({ promptPackage: pkg, maxTokens: 400 })
  const parsed = parseJsonResponse<ReinforcementResult>(result.text)

  const validMascots = ['munch', 'ollie', 'ellie', 'pandy', 'dobby', 'coco', 'froggy', 'bubbles', 'chicky']
  if (!validMascots.includes(parsed.mascot)) {
    parsed.mascot = 'munch'
  }
  return parsed
}

/**
 * Generate reinforcement with reasoning package context via LLMGateway.
 * Throws GatewayError or SyntaxError on failure (no silent synthetic fallbacks).
 */
export async function generateReinforcementWithReasoning(
  reasoningPackage: ReasoningPackage,
  selectedOption: string,
  category: Category,
  userNickname = 'friend',
  userName = 'friend'
): Promise<ReinforcementResult> {
  const { context, observations, conflicts, uncertainties } = reasoningPackage
  const gateway = new LLMGateway()

  const pkg = buildPromptPackage([
    {
      id: 'system_guidelines',
      type: 'system',
      priority: 1.0,
      required: true,
      content: `You are Munch 🍀, a gentle four-leaf clover companion that helps ${userNickname} slow down, understand their thoughts, and make decisions they feel comfortable with.`
    },
    {
      id: 'mascot_identity_munch',
      type: 'identity',
      priority: 0.9,
      required: true,
      content: {
        mascotId: 'munch',
        identity: 'Companion',
        mascots: 'munch (Understanding), ollie (Reflection), ellie (Reassurance), pandy (Comfort), dobby (Encouragement), coco (Curiosity), froggy (Calm), bubbles (Openness), chicky (Joy)'
      }
    },
    {
      id: 'personality_guidelines',
      type: 'personality',
      priority: 0.8,
      required: true,
      content: {
        dominantTrait: 'empathetic',
        communicationStyle: 'gentle',
        traits: 'Gentle, Observant, Playful, Encouraging, Thoughtful, Calm, Optimistic. Never sound robotic or analytical.'
      }
    },
    {
      id: 'conversation_history',
      type: 'conversation',
      priority: 0.4,
      required: true,
      content: {
        category,
        selectedOption,
        observations,
        conflicts,
        uncertainties,
        context
      }
    },
    {
      id: 'response_plan',
      type: 'response_plan',
      priority: 0.3,
      required: true,
      content: {
        steps: [
          '1. Reflect feelings: Acknowledge emotional state or difficulty of choosing.',
          '2. Explain why it feels right: Connect selected option to importance and observations.',
          '3. Reassure user: Remind them they do not need a perfect choice.',
          '4. Encourage action gently: Simple friendly check-in question.'
        ],
        constraints: 'Target 60-120 words. Max 1 emoji. No analytical jargon.'
      }
    },
    {
      id: 'output_instructions',
      type: 'instructions',
      priority: 0.2,
      required: true,
      content: 'Output strictly JSON with keys: "selected_option", "reasoning", "encouragement", "follow_up_question", "mascot".'
    }
  ])

  const result = await gateway.generate({ promptPackage: pkg, maxTokens: 400 })
  const parsed = parseJsonResponse<ReinforcementResult>(result.text)

  const validMascots = ['munch', 'ollie', 'ellie', 'pandy', 'dobby', 'coco', 'froggy', 'bubbles', 'chicky']
  if (!validMascots.includes(parsed.mascot)) {
    parsed.mascot = 'munch'
  }
  return parsed
}
