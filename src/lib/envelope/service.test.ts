import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkEnvelopeCooldown,
  evaluatePendingMilestone,
  resolveEmotionalContext,
  selectMascotPersonality,
  selectWeightedScene,
  generateMunchNotices,
  getWelcomeState
} from './service'

// Mock Supabase Server helper
const mockSingleEnvelope = {
  id: 'let_123',
  user_id: 'user_123',
  letter_type: 'signup',
  milestone_key: null,
  content: 'Welcome to Munch!',
  mascot_character_used: 'munch',
  mascot_expression: 'happy',
  scene_used: 'default',
  presentation_type: 'envelope',
  relationship_level_snapshot: 'new',
  nickname_snapshot: 'Sam',
  is_read: false,
  created_at: new Date().toISOString()
}

let mockEnvelopeData: any[] = []
let mockDecisionsCount = 0
let mockMemoriesCount = 0
let mockBeliefsData: any[] = []
let mockObservationsData: any[] = []
let mockUserData: any = { created_at: new Date().toISOString(), last_active_at: new Date().toISOString(), name: 'Sam' }

// Generic thenable mock query builder for Supabase
function createMockQueryBuilder(table: string) {
  const builder = {
    then: (resolve: any) => {
      let data: any = []
      if (table === 'envelope_letters') data = mockEnvelopeData
      else if (table === 'decisions') data = []
      else if (table === 'user_memories') data = []
      else if (table === 'user_beliefs') data = mockBeliefsData
      else if (table === 'user_observations') data = mockObservationsData
      else if (table === 'users') data = mockUserData

      resolve({ data, count: table === 'decisions' ? mockDecisionsCount : table === 'user_memories' ? mockMemoriesCount : undefined, error: null })
    },
    select: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => builder),
    limit: vi.fn().mockImplementation((lim) => {
      const builderWithLimit = { ...builder } as any
      builderWithLimit.then = (resolve: any) => {
        let data: any = []
        if (table === 'envelope_letters') {
          const sorted = [...mockEnvelopeData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          data = sorted.slice(0, lim)
        } else if (table === 'user_observations') {
          data = mockObservationsData.slice(0, lim)
        }
        resolve({ data, error: null })
      }
      builderWithLimit.maybeSingle = vi.fn().mockImplementation(() => {
        return {
          then: (resolve: any) => {
            let data: any = null
            if (table === 'envelope_letters') {
              const sorted = [...mockEnvelopeData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              data = sorted[0] || null
            }
            resolve({ data, error: null })
          }
        }
      })
      builderWithLimit.single = vi.fn().mockImplementation(() => {
        return {
          then: (resolve: any) => {
            let data: any = null
            if (table === 'envelope_letters') {
              const sorted = [...mockEnvelopeData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              data = sorted[0] || null
            } else if (table === 'users') {
              data = mockUserData
            }
            resolve({ data, error: null })
          }
        }
      })
      return builderWithLimit
    }),
    insert: vi.fn().mockImplementation((payload) => {
      const arr = Array.isArray(payload) ? payload : [payload]
      mockEnvelopeData.push(...arr)
      return builder
    }),
    update: vi.fn().mockImplementation(() => builder),
    maybeSingle: vi.fn().mockImplementation(() => {
      return {
        then: (resolve: any) => {
          let data: any = null
          if (table === 'users') data = mockUserData
          resolve({ data, error: null })
        }
      }
    }),
    single: vi.fn().mockImplementation(() => {
      return {
        then: (resolve: any) => {
          let data: any = null
          if (table === 'users') data = mockUserData
          resolve({ data, error: null })
        }
      }
    })
  }

  return builder
}

// Mock Supabase Client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve({
    from: vi.fn().mockImplementation((table: string) => createMockQueryBuilder(table))
  }))
}))

// Mock Nickname Service
vi.mock('@/lib/nickname/service', () => ({
  getGreetingName: vi.fn().mockResolvedValue('Sam'),
  getRelationshipState: vi.fn().mockResolvedValue({ level: 'new', score: 10 })
}))

// Mock Gemini generative AI sdk
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockImplementation(() => ({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: vi.fn().mockReturnValue(JSON.stringify({ letter: 'Generative letter text.' }))
        }
      })
    }))
  }))
}))

describe('Envelope System Services', () => {
  beforeEach(() => {
    mockEnvelopeData = []
    mockDecisionsCount = 0
    mockMemoriesCount = 0
    mockBeliefsData = []
    mockObservationsData = []
    mockUserData = { created_at: new Date().toISOString(), last_active_at: new Date().toISOString(), name: 'Sam' }
    vi.clearAllMocks()
  })

  describe('checkEnvelopeCooldown', () => {
    it('should return active unread letter if is_read is false', async () => {
      mockEnvelopeData = [{ ...mockSingleEnvelope, is_read: false }]
      const res = await checkEnvelopeCooldown('user_123')
      expect(res.hasActiveUnread).toBe(true)
      expect(res.cooldownActive).toBe(true)
      expect(res.activeLetter).toBeDefined()
      expect(res.activeLetter?.letter_type).toBe('signup')
    })

    it('should trigger cooldown if a letter was generated in the last 12 hours', async () => {
      mockEnvelopeData = [
        {
          ...mockSingleEnvelope,
          is_read: true,
          created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
        }
      ]
      const res = await checkEnvelopeCooldown('user_123')
      expect(res.hasActiveUnread).toBe(false)
      expect(res.cooldownActive).toBe(true)
    })

    it('should not trigger cooldown if the last letter was generated more than 12 hours ago', async () => {
      mockEnvelopeData = [
        {
          ...mockSingleEnvelope,
          is_read: true,
          created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString() // 14 hours ago
        }
      ]
      const res = await checkEnvelopeCooldown('user_123')
      expect(res.hasActiveUnread).toBe(false)
      expect(res.cooldownActive).toBe(false)
    })
  })

  describe('evaluatePendingMilestone', () => {
    it('should trigger first_decision if user has decisions >= 1 and not yet triggered', async () => {
      mockEnvelopeData = []
      const res = await evaluatePendingMilestone('user_123', 1, 0, 1)
      expect(res).toBe('first_decision')
    })

    it('should not trigger first_decision if it has already been triggered', async () => {
      mockEnvelopeData = [
        {
          ...mockSingleEnvelope,
          letter_type: 'milestone',
          milestone_key: 'first_decision'
        }
      ]
      const res = await evaluatePendingMilestone('user_123', 1, 0, 1)
      expect(res).toBeNull()
    })

    it('should prioritize first_memory over first_week if both conditions are met', async () => {
      mockEnvelopeData = []
      const res = await evaluatePendingMilestone('user_123', 0, 1, 8)
      expect(res).toBe('first_memory')
    })
  })

  describe('selectMascotPersonality', () => {
    it('should pick Panda or Ellie if emotional context is anxious/tired', async () => {
      const res = await selectMascotPersonality('user_123', ['anxious'], 'new')
      expect(['ellie', 'pandy']).toContain(res.character)
    })

    it('should filter out recently used mascot characters from candidates', async () => {
      mockEnvelopeData = [
        { ...mockSingleEnvelope, mascot_character_used: 'ellie' }
      ]
      // Ellie should be filtered out from candidates when anxious context is matched
      const res = await selectMascotPersonality('user_123', ['anxious'], 'new')
      expect(res.character).toBe('pandy')
    })
  })

  describe('selectWeightedScene', () => {
    it('should select the least used scene to avoid repetitive cycles', async () => {
      mockEnvelopeData = [
        { ...mockSingleEnvelope, scene_used: 'morning_sun' },
        { ...mockSingleEnvelope, scene_used: 'morning_sun' },
        { ...mockSingleEnvelope, scene_used: 'twilight_glow' }
      ]
      const res = await selectWeightedScene('user_123')
      expect(['afternoon_warmth', 'midnight_peace', 'clover_garden']).toContain(res)
    })
  })

  describe('generateMunchNotices', () => {
    it('should return a notice card if a belief is verified (evidence >= 3)', async () => {
      mockBeliefsData = [
        {
          dimension: 'decision_pattern',
          key: 'rest_preference',
          value: 'choosing rest to combat fatigue',
          confidence: 0.6,
          evidence_count: 4
        }
      ]
      const res = await generateMunchNotices('user_123')
      expect(res).toHaveLength(1)
      expect(res[0]).toBe("Looks like you've been choosing rest more often recently.")
    })

    it('should hide notices if beliefs confidence is low', async () => {
      mockBeliefsData = [
        {
          dimension: 'decision_pattern',
          key: 'rest_preference',
          value: 'choosing rest',
          confidence: 0.4,
          evidence_count: 1
        }
      ]
      const res = await generateMunchNotices('user_123')
      expect(res).toHaveLength(0)
    })
  })
})
