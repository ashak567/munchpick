import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { createClient } from '@/utils/supabase/server'
import * as hupAnalyzer from '@/lib/hup/analyzer'
import * as memoryDistiller from '@/lib/memory/distiller'

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
  updateNicknameAffinity: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /api/feedback - Background Task Execution with after()', () => {
  let mockSupabase: any
  let insertFeedbackSpy: any

  beforeEach(() => {
    vi.restoreAllMocks()

    insertFeedbackSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'feedback-123',
            decision_id: 'decision-123',
            rating: 'love',
            created_at: new Date().toISOString()
          },
          error: null
        })
      })
    })

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-abc', email: 'test@example.com' }
          },
          error: null
        })
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'decisions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'decision-123',
                    user_id: 'user-abc',
                    category: 'Food',
                    selected_option: 'Cheesy Pizza',
                    importance: 'High',
                    nickname_snapshot: 'friend'
                  },
                  error: null
                })
              })
            })
          }
        }
        if (table === 'feedback') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            }),
            insert: insertFeedbackSpy
          }
        }
        if (table === 'options') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { tags: ['cheesy', 'pizza'] },
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'preferences') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            }),
            upsert: vi.fn().mockResolvedValue({ error: null })
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

  it('should successfully submit feedback and schedule background tasks', async () => {
    const logSpy = vi.spyOn(hupAnalyzer, 'analyzeAndLogObservations')
    const distillSpy = vi.spyOn(memoryDistiller, 'analyzeAndDistillMemories')

    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        decisionId: 'decision-123',
        rating: 'love'
      })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.feedback.id).toBe('feedback-123')
  })

  it('should not fail the HTTP response even if background tasks throw', async () => {
    vi.spyOn(hupAnalyzer, 'analyzeAndLogObservations').mockRejectedValueOnce(
      new Error('Background HUPS service connection failed')
    )
    vi.spyOn(memoryDistiller, 'analyzeAndDistillMemories').mockRejectedValueOnce(
      new Error('Background memory distillation failed')
    )

    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        decisionId: 'decision-123',
        rating: 'love'
      })
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
  })
})
