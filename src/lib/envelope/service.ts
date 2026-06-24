import { GoogleGenerativeAI } from '@google/generative-ai'
import { serverEnv } from '@/lib/env'
import { createClient } from '@/utils/supabase/server'
import { MascotCharacter, MascotExpression } from '@/components/Mascot'
import { getRelationshipState, getGreetingName } from '@/lib/nickname/service'
import { EnvelopeLetterType, EnvelopeLetter, WelcomeState } from './types'

// Initialize Gemini safely
const getGeminiModel = () => {
  const apiKey = serverEnv.GEMINI_API_KEY || ''
  if (!apiKey || apiKey === 'MOCK_KEY') return null
  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  })
}

/**
 * Checks if the user is in an envelope cooldown period or has an active unread envelope.
 */
export async function checkEnvelopeCooldown(userId: string): Promise<{
  hasActiveUnread: boolean
  cooldownActive: boolean
  activeLetter: EnvelopeLetter | null
}> {
  const supabase = await createClient()

  // Fetch the latest envelope letter for the user
  const { data: latest, error } = await supabase
    .from('envelope_letters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[EnvelopeService] Error fetching latest envelope:', error)
    return { hasActiveUnread: false, cooldownActive: false, activeLetter: null }
  }

  if (!latest) {
    return { hasActiveUnread: false, cooldownActive: false, activeLetter: null }
  }

  const activeLetter = latest as EnvelopeLetter

  // 1. If there is an unread envelope, it is active and blocks new generations
  if (!activeLetter.is_read) {
    return { hasActiveUnread: true, cooldownActive: true, activeLetter }
  }

  // 2. If a letter was generated in the last 12 hours, cooldown is active (prevent spam)
  const timeSinceLastGeneration = Date.now() - new Date(activeLetter.created_at).getTime()
  const twelveHoursMs = 12 * 60 * 60 * 1000
  if (timeSinceLastGeneration < twelveHoursMs) {
    return { hasActiveUnread: false, cooldownActive: true, activeLetter }
  }

  return { hasActiveUnread: false, cooldownActive: false, activeLetter: null }
}

/**
 * Checks for pending milestones that have not been triggered yet.
 */
export async function evaluatePendingMilestone(
  userId: string,
  decisionsCount: number,
  memoriesCount: number,
  daysSinceSignup: number
): Promise<string | null> {
  const supabase = await createClient()

  // Query already triggered milestones
  const { data: triggered, error } = await supabase
    .from('envelope_letters')
    .select('milestone_key')
    .eq('user_id', userId)
    .eq('letter_type', 'milestone')

  if (error) {
    console.error('[EnvelopeService] Error fetching triggered milestones:', error)
    return null
  }

  const triggeredKeys = new Set((triggered || []).map((t) => t.milestone_key).filter(Boolean))

  const milestoneChecklist = [
    { key: 'first_decision', condition: decisionsCount >= 1 },
    { key: '10_decisions', condition: decisionsCount >= 10 },
    { key: '25_decisions', condition: decisionsCount >= 25 },
    { key: '50_decisions', condition: decisionsCount >= 50 },
    { key: '100_decisions', condition: decisionsCount >= 100 },
    { key: 'first_memory', condition: memoriesCount >= 1 },
    { key: 'first_week', condition: daysSinceSignup >= 7 }
  ]

  for (const milestone of milestoneChecklist) {
    if (milestone.condition && !triggeredKeys.has(milestone.key)) {
      return milestone.key
    }
  }

  return null
}

/**
 * Resolves the user's recent emotional context from observations.
 */
export async function resolveEmotionalContext(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data: obs } = await supabase
    .from('user_observations')
    .select('observed_value, dimension')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  const context: string[] = []
  if (!obs) return context

  obs.forEach((o) => {
    const val = JSON.stringify(o.observed_value).toLowerCase()
    if (val.includes('anxious') || val.includes('worry') || val.includes('stress') || val.includes('fear')) {
      context.push('anxious')
    }
    if (val.includes('tired') || val.includes('exhaust') || val.includes('fatigue') || val.includes('burnout')) {
      context.push('tired')
    }
    if (val.includes('happy') || val.includes('joy') || val.includes('excite') || val.includes('success')) {
      context.push('happy')
    }
    if (val.includes('slow') || val.includes('deliberate') || val.includes('ponder') || val.includes('reflect')) {
      context.push('reflective')
    }
  })

  return Array.from(new Set(context))
}

/**
 * Selects a mascot character using personality traits, emotional context, and history.
 */
export async function selectMascotPersonality(
  userId: string,
  emotionalContext: string[],
  relationshipLevel: string
): Promise<{ character: MascotCharacter; expression: MascotExpression }> {
  const supabase = await createClient()

  // Fetch recent mascot history (last 3 letters) to prevent repetitive picks
  const { data: history } = await supabase
    .from('envelope_letters')
    .select('mascot_character_used')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  const recentMascots = (history || []).map((h) => h.mascot_character_used as MascotCharacter)

  // Map personality options based on emotional context and level
  let candidates: MascotCharacter[] = []

  const isAnxiousOrTired = emotionalContext.includes('anxious') || emotionalContext.includes('tired')
  const isReflective = emotionalContext.includes('reflective')
  const isHappy = emotionalContext.includes('happy')

  if (isAnxiousOrTired) {
    candidates.push('ellie', 'pandy') // Ellie (gentle listener), Pandy (comfort provider)
  }
  if (isReflective) {
    candidates.push('ollie', 'munch') // Ollie (reflective thinker), Munch (balanced guide)
  }
  if (isHappy) {
    candidates.push('chicky', 'dobby') // Chicky (joy), Dobby (encouragement)
  }

  // Fallback / default candidates
  if (candidates.length === 0) {
    if (relationshipLevel === 'new' || relationshipLevel === 'familiar') {
      candidates = ['ellie', 'munch', 'pandy']
    } else {
      candidates = ['munch', 'ollie', 'dobby', 'coco', 'froggy', 'bubbles']
    }
  }

  // Filter out recent mascots from candidates if we have other options available
  const freshCandidates = candidates.filter((c) => !recentMascots.includes(c))
  const finalCandidates = freshCandidates.length > 0 ? freshCandidates : candidates

  // Pick randomly from the final candidates
  const character = finalCandidates[Math.floor(Math.random() * finalCandidates.length)]

  // Set expressions based on character and context
  let expression: MascotExpression = 'idle'
  if (isHappy && (character === 'chicky' || character === 'dobby')) {
    expression = 'happy'
  } else if (isReflective && character === 'ollie') {
    expression = 'think'
  } else if (isAnxiousOrTired && character === 'pandy') {
    expression = 'wry'
  }

  return { character, expression }
}

/**
 * Weights and selects a visual scene based on usage history to avoid repetitive cycles.
 */
export async function selectWeightedScene(userId: string): Promise<string> {
  const supabase = await createClient()

  // Fetch scene usage counts from user's history
  const { data: history } = await supabase
    .from('envelope_letters')
    .select('scene_used')
    .eq('user_id', userId)

  const usageCounts: Record<string, number> = {
    morning_sun: 0,
    afternoon_warmth: 0,
    twilight_glow: 0,
    midnight_peace: 0,
    clover_garden: 0
  }

  if (history) {
    history.forEach((h) => {
      if (usageCounts[h.scene_used] !== undefined) {
        usageCounts[h.scene_used]++
      }
    })
  }

  // Sort scenes by usage count ascending
  const sortedScenes = Object.entries(usageCounts).sort((a, b) => a[1] - b[1])
  const minUsage = sortedScenes[0][1]

  // Filter all scenes that share the lowest usage frequency
  const bestScenes = sortedScenes.filter((s) => s[1] === minUsage).map((s) => s[0])

  // Select randomly among the least used scenes
  return bestScenes[Math.floor(Math.random() * bestScenes.length)]
}

/**
 * Generates verified evidence-based notices (Munch Notices) with uncertainty safeguards.
 */
export async function generateMunchNotices(userId: string): Promise<string[]> {
  const supabase = await createClient()

  // Fetch user beliefs matching the evidence threshold
  const { data: beliefs } = await supabase
    .from('user_beliefs')
    .select('dimension, key, value, confidence, evidence_count')
    .eq('user_id', userId)

  if (!beliefs || beliefs.length === 0) {
    return []
  }

  // Filter for evidence_count >= 3 OR confidence >= 0.7
  const verifiedBeliefs = beliefs.filter(
    (b) => b.evidence_count >= 3 || Number(b.confidence) >= 0.7
  )

  const notices: string[] = []

  verifiedBeliefs.forEach((belief) => {
    const val = String(belief.value).toLowerCase()
    const key = String(belief.key).toLowerCase()
    const combined = `${key} ${val}`

    if (belief.dimension === 'interests') {
      if (combined.includes('study') || combined.includes('learn') || combined.includes('school') || combined.includes('homework')) {
        notices.push("You've been making lots of study decisions lately.")
      } else if (combined.includes('game') || combined.includes('play') || combined.includes('gaming')) {
        notices.push("Gaming keeps appearing in your choices.")
      } else if (combined.includes('food') || combined.includes('cook') || combined.includes('eat') || combined.includes('dining')) {
        notices.push("Food options and cozy meals seem to occupy a warm spot in your picks.")
      }
    } else if (belief.dimension === 'decision_pattern') {
      if (combined.includes('slow') || combined.includes('deliberate') || combined.includes('thoughtful')) {
        notices.push("You've been taking your time with choices recently.")
      } else if (combined.includes('rest') || combined.includes('sleep') || val.includes('break')) {
        notices.push("Looks like you've been choosing rest more often recently.")
      }
    }
  })

  // Limit to at most 2 unique notices
  return Array.from(new Set(notices)).slice(0, 2)
}

/**
 * Generates letter content using Gemini (with rule-based fallbacks and safety rules).
 */
export async function generateLetterContent(
  userId: string,
  nickname: string,
  relationshipLevel: string,
  triggerType: EnvelopeLetterType,
  milestoneKey: string | null
): Promise<string> {
  const supabase = await createClient()

  // 1. Fetch recent memories for personalization
  const { data: memories } = await supabase
    .from('user_memories')
    .select('summary')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  const recentMemoriesText = (memories || []).map((m) => m.summary).join(', ')

  // 2. Default fallbacks
  const fallbacks: Record<string, string> = {
    signup: `Welcome to Munch, ${nickname}. Take a slow breath. I'm here to help you find comfort in your choices. Let's write down what's on your mind.`,
    daily_return: `Hi ${nickname}. It's good to see you again. I hope you're taking care of your rhythm today. What are we figuring out?`,
    inactivity: `Welcome back, ${nickname}. It's been a little while since we last checked in. I'm right here whenever you're ready to share.`,
    milestone: `Hi ${nickname}. We're hitting a gentle milestone together. That's a soft step forward. I'm glad to walk this path with you.`
  }

  const milestoneFallbacks: Record<string, string> = {
    first_decision: `Hi ${nickname}. We made our very first choice together. That's a gentle step forward. I'm glad to walk this path with you.`,
    '10_decisions': `Hello ${nickname}. We've shared ten choices together. I'm glad we could slow down the noise for these moments.`,
    '25_decisions': `Hi ${nickname}. Twenty-five choices made! Thank you for sharing these steps in your day with me.`,
    '50_decisions': `Greetings ${nickname}. Fifty decisions together. It's a quiet rhythm we're building, one step at a time.`,
    '100_decisions': `Dear ${nickname}. One hundred choices explored. Thank you for trusting me with your thoughts. I'm glad to be here.`,
    first_memory: `Hi ${nickname}. We saved our first memory together. It's nice to keep a small journal of what brings you comfort.`,
    first_week: `Hello ${nickname}. A whole week since we met. I'm glad we've been sharing this space.`
  }

  const defaultContent = milestoneKey ? (milestoneFallbacks[milestoneKey] || fallbacks.milestone) : fallbacks[triggerType]

  const model = getGeminiModel()
  if (model) {
    const prompt = `
You are Munch 🍀, a gentle four-leaf clover companion.
We need to generate a warm, gentle letter (exactly 1 to 2 sentences) for the user.
You MUST follow these safety rules:
- Never fabricate memories, emotions, or relationships.
- Use uncertainty language if evidence is weak (e.g. "I wonder if...", "You might be feeling...").
- Do not exaggerate the relationship level.
- Focus on gentle companionship, not sounding intelligent or diagnostic.

Context:
- User Nickname: ${nickname}
- Relationship Level: ${relationshipLevel}
- Trigger Type: ${triggerType}
- Milestone Key (if milestone): ${milestoneKey || 'none'}
- Recent Stored Memories: [${recentMemoriesText}]

Write a short handwritten-style letter based on this context. Output must be JSON format:
{
  "letter": "Your generated letter content here"
}
`

    try {
      const response = await model.generateContent(prompt)
      const text = response.response.text()
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed.letter === 'string' && parsed.letter.trim()) {
        return parsed.letter.trim()
      }
    } catch (err) {
      console.warn('[EnvelopeService] Gemini letter generation failed, falling back:', err)
    }
  }

  return defaultContent
}

/**
 * Resolves a dynamic welcome state, checking for envelope triggers or applying freshness.
 */
export async function getWelcomeState(userId: string): Promise<WelcomeState> {
  const supabase = await createClient()

  // 1. Resolve User and Nickname/Level
  const { data: userRecord } = await supabase
    .from('users')
    .select('created_at, last_active_at, name')
    .eq('id', userId)
    .single()

  const userName = userRecord?.name || 'friend'
  const nickname = await getGreetingName(userId)
  const { level } = await getRelationshipState(userId)

  // 2. Fetch Munch Notices
  const notices = await generateMunchNotices(userId)

  // 3. Check Cooldown & Active Envelope
  const { hasActiveUnread, cooldownActive, activeLetter } = await checkEnvelopeCooldown(userId)

  if (hasActiveUnread && activeLetter) {
    // Return existing unread envelope
    return {
      greeting: `Hello, ${nickname}!`,
      presentation_type: activeLetter.presentation_type,
      letter: activeLetter,
      mascot_character: activeLetter.mascot_character_used as MascotCharacter,
      mascot_expression: activeLetter.mascot_expression as MascotExpression,
      mascot_message: "You've got a letter waiting! 🍀",
      visual_scene: activeLetter.scene_used,
      notices
    }
  }

  // 4. Evaluate triggers (Milestone > Inactivity > Daily Return > Signup)
  let triggerType: EnvelopeLetterType | null = null
  let milestoneKey: string | null = null

  // Fetch counts for triggers
  const { count: decisionsCount } = await supabase
    .from('decisions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: memoriesCount } = await supabase
    .from('user_memories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const signupDate = userRecord?.created_at ? new Date(userRecord.created_at) : new Date()
  const daysSinceSignup = Math.floor((Date.now() - signupDate.getTime()) / (24 * 60 * 60 * 1000))

  const { count: lettersCount } = await supabase
    .from('envelope_letters')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const isNewUser = (lettersCount || 0) === 0

  if (!cooldownActive) {
    if (isNewUser) {
      triggerType = 'signup'
    } else {
      // Check Milestone
      const pendingMilestone = await evaluatePendingMilestone(
        userId,
        decisionsCount || 0,
        memoriesCount || 0,
        daysSinceSignup
      )
      if (pendingMilestone) {
        triggerType = 'milestone'
        milestoneKey = pendingMilestone
      } else {
        // Check 72-hour Inactivity
        const lastActiveTime = userRecord?.last_active_at ? new Date(userRecord.last_active_at).getTime() : Date.now()
        const inactivityMs = 72 * 60 * 60 * 1000
        const dailyReturnMs = 16 * 60 * 60 * 1000

        if (Date.now() - lastActiveTime >= inactivityMs) {
          triggerType = 'inactivity'
        } else if (Date.now() - lastActiveTime >= dailyReturnMs) {
          triggerType = 'daily_return'
        }
      }
    }
  }

  // 5. Generate and Save new envelope if trigger is resolved
  if (triggerType) {
    const emotionalContext = await resolveEmotionalContext(userId)
    const { character, expression } = await selectMascotPersonality(userId, emotionalContext, level)
    const scene = await selectWeightedScene(userId)
    const content = await generateLetterContent(userId, nickname, level, triggerType, milestoneKey)

    // 60% envelope, 40% direct
    const presentationType = Math.random() < 0.6 ? 'envelope' : 'direct'

    const { data: newLetter, error: insertError } = await supabase
      .from('envelope_letters')
      .insert({
        user_id: userId,
        letter_type: triggerType,
        milestone_key: milestoneKey,
        content,
        mascot_character_used: character,
        mascot_expression: expression,
        scene_used: scene,
        presentation_type: presentationType,
        relationship_level_snapshot: level,
        nickname_snapshot: nickname,
        is_read: false
      })
      .select()
      .single()

    if (insertError) {
      console.error('[EnvelopeService] Failed to insert new envelope letter:', insertError)
    } else if (newLetter) {
      const letter = newLetter as EnvelopeLetter
      return {
        greeting: `Hello, ${nickname}!`,
        presentation_type: presentationType,
        letter,
        mascot_character: character,
        mascot_expression: expression,
        mascot_message: "Here's a small note for you. 🍀",
        visual_scene: scene,
        notices
      }
    }
  }

  // 6. Session Freshness Engine: Default Dynamic Welcome (No Envelope)
  const now = new Date()
  const hour = now.getHours()
  let timeOfDayKey = 'morning'
  if (hour >= 18 || hour < 5) timeOfDayKey = 'night'
  else if (hour >= 12) timeOfDayKey = 'afternoon'

  const greetingOptions: Record<string, string[]> = {
    morning: [
      `Good morning, ${nickname}.`,
      `A fresh start, ${nickname}.`,
      `Warm morning to you, ${nickname}.`
    ],
    afternoon: [
      `Good afternoon, ${nickname}.`,
      `How is your day unfolding, ${nickname}?`,
      `Taking a gentle breath this afternoon, ${nickname}?`
    ],
    night: [
      `Good evening, ${nickname}.`,
      `Slowing down for the night, ${nickname}?`,
      `Resting your thoughts, ${nickname}?`
    ]
  }

  const greetings = greetingOptions[timeOfDayKey]
  const selectedGreeting = greetings[Math.floor(Math.random() * greetings.length)]

  // Rotate mascot and scene using history to avoid repetition
  const emotionalContext = await resolveEmotionalContext(userId)
  const { character, expression } = await selectMascotPersonality(userId, emotionalContext, level)
  const scene = await selectWeightedScene(userId)

  // Custom micro messages
  const microMessages: Record<MascotCharacter, string[]> = {
    munch: ["Take your time. 🍀", "One step at a time.", "Quiet the noise."],
    ollie: ["Wisdom lies in slowing down. 🦉", "Reflect, then choose.", "Breathe gently."],
    ellie: ["You don't have to carry it all. 🐘", "I'm listening.", "A safe space."],
    pandy: ["Comfort first. 🐼", "Wrap yourself in quiet.", "No rush."],
    dobby: ["You've got this! 🐶", "Ready when you are!", "Let's make a choice!"],
    coco: ["What if we explore? 🐱", "Curiosity is a gentle path.", "Purr..."],
    froggy: ["Peace is in the present. 🐸", "Just breathing.", "Ribbit... stay calm."],
    bubbles: ["Just keep swimming. 🐟", "Go with the flow.", "Breathe bubbles."],
    chicky: ["Find joy in small things! 🐤", "A bright moment!", "Chirp!"]
  }

  const messages = microMessages[character] || ["Hi friend! 🍀"]
  const mascotMessage = messages[Math.floor(Math.random() * messages.length)]

  // Update last_active_at in background asynchronously
  supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) console.error('[EnvelopeService] Failed to update user last active time:', error)
    })

  return {
    greeting: selectedGreeting,
    presentation_type: 'direct',
    letter: null,
    mascot_character: character,
    mascot_expression: expression,
    mascot_message: mascotMessage,
    visual_scene: scene,
    notices
  }
}

/**
 * Marks the active envelope letter as read.
 */
export async function markEnvelopeAsRead(userId: string, letterId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('envelope_letters')
    .update({ is_read: true })
    .eq('id', letterId)
    .eq('user_id', userId)

  if (error) {
    console.error('[EnvelopeService] Failed to mark envelope as read:', error)
  }

  // Update last_active_at
  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)
}
