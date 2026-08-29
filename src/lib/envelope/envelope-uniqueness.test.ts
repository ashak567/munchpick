import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkEnvelopeRepetition,
  generateContextualFallback,
  normalizeText,
  getJaccardSimilarity,
  getLevenshteinSimilarity,
  extractContentTokens
} from './anti-repetition'
import {
  generateLetterContent,
  getWelcomeState,
  getPreviousEnvelopesForConversation,
  checkEnvelopeCooldown
} from './service'
import type { EnvelopeLetter } from './types'

// Mock state
let mockEnvelopeStore: any[] = []
let mockUserStore: Record<string, any> = {}
let mockChatStore: any[] = []
let mockMessageStore: any[] = []

function createSupabaseMock() {
  return {
    from: (table: string) => {
      let filters: Array<{ col: string; val: any }> = []
      let limitCount: number | null = null
      let orderCol: string | null = null
      let isAsc = false

      const queryBuilder: any = {
        select: vi.fn(() => queryBuilder),
        eq: vi.fn((col: string, val: any) => {
          filters.push({ col, val })
          return queryBuilder
        }),
        order: vi.fn((col: string, opts?: { ascending: boolean }) => {
          orderCol = col
          isAsc = opts?.ascending ?? false
          return queryBuilder
        }),
        limit: vi.fn((lim: number) => {
          limitCount = lim
          return queryBuilder
        }),
        insert: vi.fn((payload: any) => {
          const arr = Array.isArray(payload) ? payload : [payload]
          const inserted = arr.map((item, idx) => ({
            id: `id_${Date.now()}_${idx}`,
            created_at: new Date().toISOString(),
            ...item
          }))
          if (table === 'envelope_letters') mockEnvelopeStore.push(...inserted)
          if (table === 'chats') mockChatStore.push(...inserted)
          if (table === 'chat_messages') mockMessageStore.push(...inserted)

          return {
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
              maybeSingle: async () => ({ data: inserted[0], error: null })
            }),
            single: async () => ({ data: inserted[0], error: null }),
            then: (resolve: any) => resolve({ data: inserted, error: null })
          }
        }),
        update: vi.fn((updates: any) => {
          if (table === 'envelope_letters') {
            mockEnvelopeStore.forEach(item => {
              const matches = filters.every(f => item[f.col] === f.val)
              if (matches) Object.assign(item, updates)
            })
          }
          return {
            eq: queryBuilder.eq,
            then: (resolve: any) => resolve({ data: null, error: null })
          }
        }),
        maybeSingle: async () => {
          let rows = getRows(table)
          rows = applyFilters(rows, filters)
          rows = applySort(rows, orderCol, isAsc)
          return { data: rows[0] || null, error: null }
        },
        single: async () => {
          let rows = getRows(table)
          rows = applyFilters(rows, filters)
          rows = applySort(rows, orderCol, isAsc)
          return { data: rows[0] || null, error: null }
        },
        then: (resolve: any) => {
          let rows = getRows(table)
          rows = applyFilters(rows, filters)
          rows = applySort(rows, orderCol, isAsc)
          if (limitCount) rows = rows.slice(0, limitCount)
          resolve({
            data: rows,
            count: rows.length,
            error: null
          })
        }
      }
      return queryBuilder
    }
  }
}

function getRows(table: string): any[] {
  if (table === 'envelope_letters') return [...mockEnvelopeStore]
  if (table === 'chats') return [...mockChatStore]
  if (table === 'chat_messages') return [...mockMessageStore]
  if (table === 'users') return Object.values(mockUserStore)
  if (table === 'decisions' || table === 'user_memories' || table === 'user_beliefs' || table === 'user_observations') return []
  return []
}

function applyFilters(rows: any[], filters: Array<{ col: string; val: any }>) {
  return rows.filter(row => filters.every(f => row[f.col] === f.val))
}

function applySort(rows: any[], orderCol: string | null, isAsc: boolean) {
  if (!orderCol) return rows
  return [...rows].sort((a, b) => {
    const valA = new Date(a[orderCol]).getTime() || a[orderCol]
    const valB = new Date(b[orderCol]).getTime() || b[orderCol]
    return isAsc ? valA - valB : valB - valA
  })
}

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve(createSupabaseMock()))
}))

vi.mock('@/lib/nickname/service', () => ({
  getGreetingName: vi.fn().mockImplementation(async (userId: string) => {
    return mockUserStore[userId]?.name || 'friend'
  }),
  getRelationshipState: vi.fn().mockResolvedValue({ level: 'familiar', score: 25 })
}))

describe('Phase 8.5 — Envelope Message Uniqueness & Anti-Repetition Specification', { timeout: 15000 }, () => {
  beforeEach(() => {
    mockEnvelopeStore = []
    mockChatStore = []
    mockMessageStore = []
    mockUserStore = {
      user_A: { id: 'user_A', name: 'Alice', created_at: new Date().toISOString(), last_active_at: new Date().toISOString() },
      user_B: { id: 'user_B', name: 'Bob', created_at: new Date().toISOString(), last_active_at: new Date().toISOString() }
    }
    vi.clearAllMocks()
  })

  // A. Two consecutive envelope generations in the same conversation produce different content.
  it('A. Two consecutive envelope generations in the same conversation produce different content', async () => {
    const context1 = {
      userId: 'user_A',
      chatId: 'chat_1',
      currentUserMessage: 'heyy whats up',
      triggerType: 'daily_return' as const
    }
    const env1 = await generateLetterContent(context1)

    // Store first envelope in this conversation
    mockEnvelopeStore.push({
      id: 'env_1',
      user_id: 'user_A',
      chat_id: 'chat_1',
      content: env1,
      created_at: new Date(Date.now() - 1000).toISOString(),
      is_read: true
    })

    const context2 = {
      userId: 'user_A',
      chatId: 'chat_1',
      currentUserMessage: 'i am good, just chilling',
      triggerType: 'daily_return' as const
    }
    const env2 = await generateLetterContent(context2)

    expect(env1).toBeTruthy()
    expect(env2).toBeTruthy()
    expect(env1).not.toEqual(env2)

    const repCheck = checkEnvelopeRepetition(env2, [env1])
    expect(repCheck.isRepetitive).toBe(false)
  })

  // B. A newly generated envelope cannot equal a previous envelope.
  it('B. A newly generated envelope cannot equal a previous envelope', () => {
    const previous = "It sounds like you've been carrying a lot lately, Alice."
    const identicalCandidate = "It sounds like you've been carrying a lot lately, Alice."

    const result = checkEnvelopeRepetition(identicalCandidate, [previous])
    expect(result.isRepetitive).toBe(true)
    expect(result.similarityScore).toBe(1.0)
  })

  // C. Near-duplicate/semantic repetition is rejected (Levenshtein & Jaccard token overlap).
  it('C. Near-duplicate / semantic repetition is rejected', () => {
    const previous = "It sounds like you've been carrying a lot lately, Alice."
    // Minor substitution / paraphrase
    const nearParaphrase = "It sounds like you've been carrying quite a lot today, Alice."

    const result = checkEnvelopeRepetition(nearParaphrase, [previous])
    expect(result.isRepetitive).toBe(true)
  })

  it('C2. Same opening sentence is detected and rejected', () => {
    const previous = "Take a gentle breath, Alice. Whatever is on your mind, we can look at it slowly."
    const matchingOpening = "Take a gentle breath, Alice. There is plenty of time for choices."

    const result = checkEnvelopeRepetition(matchingOpening, [previous])
    expect(result.isRepetitive).toBe(true)
    expect(result.reason).toContain('opening sentence')
  })

  // D. The latest user message influences the new envelope.
  it('D. The latest user message influences the new envelope', () => {
    const projectContext = {
      userId: 'user_A',
      chatId: 'chat_1',
      nickname: 'Alice',
      currentUserMessage: "I've been working on my project for a long time and it's finally working."
    }
    const projectEnvelope = generateContextualFallback(projectContext, [])

    const worryContext = {
      userId: 'user_A',
      chatId: 'chat_1',
      nickname: 'Alice',
      currentUserMessage: "but I'm still worried something might go wrong"
    }
    const worryEnvelope = generateContextualFallback(worryContext, [projectEnvelope])

    expect(projectEnvelope.toLowerCase()).toMatch(/project|working|effort|accomplished|progress/)
    expect(worryEnvelope.toLowerCase()).toMatch(/worr|anxious|fear|doubt|weight|uncertain/)
    expect(projectEnvelope).not.toEqual(worryEnvelope)
  })

  // E. Reopening an old conversation does not regenerate old envelopes.
  it('E. Reopening an old conversation returns existing unread envelope without regenerating', async () => {
    const existingContent = "Welcome back, Alice. You have a quiet space right here."
    mockEnvelopeStore.push({
      id: 'existing_letter_1',
      user_id: 'user_A',
      chat_id: 'chat_old_1',
      content: existingContent,
      presentation_type: 'envelope',
      mascot_character_used: 'munch',
      mascot_expression: 'idle',
      scene_used: 'clover_garden',
      is_read: false,
      created_at: new Date().toISOString()
    })

    const welcome = await getWelcomeState('user_A', { chatId: 'chat_old_1' })
    expect(welcome.letter).toBeDefined()
    expect(welcome.letter?.id).toBe('existing_letter_1')
    expect(welcome.letter?.content).toBe(existingContent)
  })

  // F. Sending a new message in an old conversation generates a fresh, context-specific envelope.
  it('F. Sending a new message in an old conversation generates a fresh envelope different from previous ones', async () => {
    const oldEnvelope = "Good to see you back today, Alice. Taking a few quiet moments for yourself is a lovely rhythm."
    mockEnvelopeStore.push({
      id: 'old_env_1',
      user_id: 'user_A',
      chat_id: 'chat_old_1',
      content: oldEnvelope,
      is_read: true,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    })

    const newContext = {
      userId: 'user_A',
      chatId: 'chat_old_1',
      nickname: 'Alice',
      currentUserMessage: 'yeah just finished a big coding milestone today!',
      triggerType: 'daily_return' as const
    }
    const freshEnvelope = await generateLetterContent(newContext)

    expect(freshEnvelope).toBeTruthy()
    expect(freshEnvelope).not.toEqual(oldEnvelope)
    const repetition = checkEnvelopeRepetition(freshEnvelope, [oldEnvelope])
    expect(repetition.isRepetitive).toBe(false)
  })

  // G. Starting a new chat does not copy the previous conversation's envelope.
  it('G. Starting a new chat preserves previous envelopes and generates fresh context for new chat', async () => {
    // Chat 1 envelope
    const chat1Envelope = "Alice, bringing something from an idea into the world is significant."
    mockEnvelopeStore.push({
      id: 'env_chat1',
      user_id: 'user_A',
      chat_id: 'chat_1',
      content: chat1Envelope,
      is_read: true,
      created_at: new Date(Date.now() - 10000).toISOString()
    })

    // Query envelopes for new Chat 2
    const chat2PrevEnvelopes = await getPreviousEnvelopesForConversation('user_A', 'chat_2')
    expect(chat2PrevEnvelopes).toHaveLength(0)

    const chat2Context = {
      userId: 'user_A',
      chatId: 'chat_2',
      nickname: 'Alice',
      currentUserMessage: 'heyy whats up',
      triggerType: 'daily_return' as const
    }
    const newChatEnvelope = await generateLetterContent(chat2Context)

    expect(newChatEnvelope).toBeTruthy()
    expect(newChatEnvelope).not.toEqual(chat1Envelope)
  })

  // H. User A's envelope history cannot affect User B's envelope generation.
  it('H. User A envelope history is isolated from User B envelope generation', async () => {
    const userAEnvelope = "Alice, take a gentle breath. Whatever you are navigating today, we can untangle it."
    mockEnvelopeStore.push({
      id: 'env_user_A',
      user_id: 'user_A',
      chat_id: 'chat_A1',
      content: userAEnvelope,
      is_read: true,
      created_at: new Date().toISOString()
    })

    const userBPrevEnvelopes = await getPreviousEnvelopesForConversation('user_B', 'chat_B1')
    expect(userBPrevEnvelopes).toEqual([])

    const userBContext = {
      userId: 'user_B',
      chatId: 'chat_B1',
      nickname: 'Bob',
      currentUserMessage: 'heyy whats up'
    }
    const userBEnvelope = await generateLetterContent(userBContext)

    expect(userBEnvelope).toContain('Bob')
    expect(userBEnvelope).not.toContain('Alice')
  })

  // I. Different users receive the same global Munch behavior while their envelope content remains contextual.
  it('I. Different users receive the same global Munch personality with distinct conversation-specific text', async () => {
    const userAContext = {
      userId: 'user_A',
      chatId: 'chat_A1',
      nickname: 'Alice',
      currentUserMessage: "I've been working on my project for a long time and it's finally working."
    }
    const userBContext = {
      userId: 'user_B',
      chatId: 'chat_B1',
      nickname: 'Bob',
      currentUserMessage: "I'm feeling really stressed about exams tomorrow."
    }

    const envA = await generateLetterContent(userAContext)
    const envB = await generateLetterContent(userBContext)

    expect(envA).toContain('Alice')
    expect(envB).toContain('Bob')
    expect(envA).not.toEqual(envB)
  })

  // J. No hardcoded email or user ID branches exist in the envelope modules.
  it('J. No hardcoded emails or user IDs in envelope codebase', async () => {
    const { readFileSync } = await import('fs')
    const { resolve } = await import('path')

    const filesToCheck = [
      'src/lib/envelope/service.ts',
      'src/lib/envelope/anti-repetition.ts',
      'src/lib/envelope/types.ts',
      'src/app/api/envelope/current/route.ts'
    ]

    const forbiddenStrings = [
      'shop.littleknock@gmail.com',
      'akashmravi06@gmail.com',
      'akashmr0@gmail.com'
    ]

    for (const file of filesToCheck) {
      const content = readFileSync(resolve(process.cwd(), file), 'utf-8')
      for (const forbidden of forbiddenStrings) {
        expect(content.toLowerCase()).not.toContain(forbidden.toLowerCase())
      }
    }
  })
})
