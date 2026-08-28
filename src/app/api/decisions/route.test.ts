import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { createClient } from '@/utils/supabase/server'
import * as geminiUtils from '@/utils/gemini'
import { GatewayError } from '@/lib/llm/gateway'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: vi.fn((fn: () => any) => {
      if (typeof fn === 'function') {
        Promise.resolve().then(() => fn()).catch(() => {})
      }
    })
  }
})

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/hup/analyzer', () => ({
  analyzeAndLogObservations: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/memory/distiller', () => ({
  analyzeAndDistillMemories: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/nickname/service', () => ({
  selectNickname: vi.fn().mockResolvedValue('friend'),
}))

vi.mock('@/lib/context/builder', () => ({
  MunchContextBuilder: class {
    buildContextAndOrchestrate = vi.fn().mockResolvedValue(null)
  },
}))

describe('POST /api/decisions - FR-009 Compliance & Elimination of Silent Fallbacks', () => {
  let mockSupabase: any
  let insertDecisionSpy: any
  let insertOptionsSpy: any

  beforeEach(() => {
    vi.restoreAllMocks()

    insertDecisionSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'decision-123',
            user_id: 'user-abc',
            category: 'Food',
            selected_option: 'Cheesy Pizza',
            reinforcement_message: 'Great choice! Enjoy! 🍕',
            reasoning: 'Great choice!',
            encouragement: 'Enjoy! 🍕',
            follow_up_question: 'Ready to order?',
            mascot: 'munch',
            importance: 'High',
            nickname_snapshot: 'friend'
          },
          error: null
        })
      })
    })

    insertOptionsSpy = vi.fn().mockResolvedValue({ error: null })

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-abc',
              email: 'test@example.com',
              user_metadata: { full_name: 'Test User' }
            }
          },
          error: null
        })
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'preferences') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          }
        }
        if (table === 'decisions') {
          return {
            insert: insertDecisionSpy,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          }
        }
        if (table === 'feedback') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          }
        }
        if (table === 'options') {
          return {
            insert: insertOptionsSpy
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })
    }

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should successfully create a decision when LLM operations succeed', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)

    vi.spyOn(geminiUtils, 'classifyOptions').mockResolvedValueOnce({
      category: 'Food',
      options: [
        { text: 'Cheesy Pizza', tags: ['cheesy', 'pizza'] },
        { text: 'Salad', tags: ['healthy', 'fresh'] }
      ]
    })

    vi.spyOn(geminiUtils, 'generateReinforcement').mockResolvedValueOnce({
      selected_option: 'Cheesy Pizza',
      reasoning: 'Pizza is delicious comfort food.',
      encouragement: 'Enjoy your meal! 🍕',
      follow_up_question: 'Ready to order?',
      mascot: 'munch'
    })

    const req = new NextRequest('http://localhost:3000/api/decisions', {
      method: 'POST',
      body: JSON.stringify({
        options: ['Cheesy Pizza', 'Salad'],
        importance: 'High'
      })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.id).toBe('decision-123')
    expect(data.category).toBe('Food')
    expect(data.selectedOption.text).toBe('Cheesy Pizza')
    expect(data.reinforcement.reasoning).toBe('Pizza is delicious comfort food.')
    expect(insertDecisionSpy).toHaveBeenCalledTimes(1)
    expect(insertOptionsSpy).toHaveBeenCalledTimes(1)
  })

  it('should return 500 and NOT persist decision when LLM classification fails', async () => {
    vi.spyOn(geminiUtils, 'classifyOptions').mockRejectedValueOnce(
      new GatewayError('unauthorized', 'LLM request failed authentication or authorization.')
    )

    const req = new NextRequest('http://localhost:3000/api/decisions', {
      method: 'POST',
      body: JSON.stringify({
        options: ['Cheesy Pizza', 'Salad']
      })
    })

    const response = await POST(req)
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toContain('authentication or authorization')
    // Crucial: No fallback returned and no decision inserted into DB
    expect(insertDecisionSpy).not.toHaveBeenCalled()
    expect(insertOptionsSpy).not.toHaveBeenCalled()
  })

  it('should return 500 and NOT persist decision when LLM reinforcement fails', async () => {
    vi.spyOn(geminiUtils, 'classifyOptions').mockResolvedValueOnce({
      category: 'Food',
      options: [
        { text: 'Cheesy Pizza', tags: ['cheesy', 'pizza'] },
        { text: 'Salad', tags: ['healthy', 'fresh'] }
      ]
    })

    vi.spyOn(geminiUtils, 'generateReinforcement').mockRejectedValueOnce(
      new GatewayError('timeout', 'LLM request timed out.')
    )

    const req = new NextRequest('http://localhost:3000/api/decisions', {
      method: 'POST',
      body: JSON.stringify({
        options: ['Cheesy Pizza', 'Salad']
      })
    })

    const response = await POST(req)
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toContain('LLM request timed out')
    // Crucial: No synthetic fallback returned and no decision inserted into DB
    expect(insertDecisionSpy).not.toHaveBeenCalled()
    expect(insertOptionsSpy).not.toHaveBeenCalled()
  })

  it('should not alter HTTP 200 response when background HUPS or memory distillation fail in after()', async () => {
    const { analyzeAndLogObservations } = await import('@/lib/hup/analyzer')
    const { analyzeAndDistillMemories } = await import('@/lib/memory/distiller')

    vi.mocked(analyzeAndLogObservations).mockRejectedValueOnce(new Error('HUPS background network timeout'))
    vi.mocked(analyzeAndDistillMemories).mockRejectedValueOnce(new Error('Memory distillation DB timeout'))

    vi.spyOn(geminiUtils, 'classifyOptions').mockResolvedValueOnce({
      category: 'Food',
      options: [
        { text: 'Cheesy Pizza', tags: ['cheesy', 'pizza'] },
        { text: 'Salad', tags: ['healthy', 'fresh'] }
      ]
    })

    vi.spyOn(geminiUtils, 'generateReinforcement').mockResolvedValueOnce({
      selected_option: 'Cheesy Pizza',
      reasoning: 'Pizza is delicious comfort food.',
      encouragement: 'Enjoy your meal! 🍕',
      follow_up_question: 'Ready to order?',
      mascot: 'munch'
    })

    const req = new NextRequest('http://localhost:3000/api/decisions', {
      method: 'POST',
      body: JSON.stringify({
        options: ['Cheesy Pizza', 'Salad'],
        importance: 'High'
      })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.id).toBe('decision-123')
    expect(data.category).toBe('Food')
    expect(insertDecisionSpy).toHaveBeenCalledTimes(1)
  })
})
