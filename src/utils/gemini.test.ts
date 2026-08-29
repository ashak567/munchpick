import { vi, describe, it, expect, beforeEach } from 'vitest'
import { classifyOptions, generateReinforcement, generateReinforcementWithReasoning } from './gemini'
import { LLMGateway, GatewayError } from '@/lib/llm/gateway'
import { ReasoningPackage } from '@/lib/orchestrator/types'

describe('Decision LLM Utilities via LLMGateway (FR-009 Compliance)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('classifyOptions', () => {
    it('should successfully parse classification response from LLMGateway', async () => {
      const mockResult = {
        category: 'Food',
        options: [
          { text: 'Cheesy Pizza', tags: ['cheesy', 'pizza'] },
          { text: 'Salmon Sushi', tags: ['japanese', 'seafood'] }
        ]
      }

      vi.spyOn(LLMGateway.prototype, 'generate').mockResolvedValueOnce({
        requestId: 'test-req',
        text: JSON.stringify(mockResult),
        streamed: false,
        metrics: {
          providerId: 'gemini',
          modelId: 'gemini-2.5-flash',
          finishReason: 'stop',
          promptTokens: 50,
          completionTokens: 20,
          totalTokens: 70,
          latency: 100,
          retries: 0,
          timeoutMs: 5000,
          gatewayVersion: 'v1.0.0'
        }
      })

      const result = await classifyOptions(['Cheesy Pizza', 'Salmon Sushi'])
      expect(result.category).toBe('Food')
      expect(result.options).toHaveLength(2)
      expect(result.options[0].tags).toEqual(['cheesy', 'pizza'])
    })

    it('should throw error when LLMGateway fails (no silent fallback)', async () => {
      vi.spyOn(LLMGateway.prototype, 'generate').mockRejectedValueOnce(
        new GatewayError('unauthorized', 'Authentication failed')
      )

      await expect(classifyOptions(['Cheesy Pizza', 'Salmon Sushi'])).rejects.toThrow(
        'Authentication failed'
      )
    })
  })

  describe('generateReinforcement', () => {
    it('should successfully parse reinforcement response from LLMGateway', async () => {
      const mockResult = {
        selected_option: 'Cheesy Pizza',
        reasoning: 'Pizza brings delicious comfort when you need a pause.',
        encouragement: 'Enjoy every slice! 🍕',
        follow_up_question: 'How does that sound?',
        mascot: 'munch'
      }

      vi.spyOn(LLMGateway.prototype, 'generate').mockResolvedValueOnce({
        requestId: 'test-req-2',
        text: JSON.stringify(mockResult),
        streamed: false,
        metrics: {
          providerId: 'gemini',
          modelId: 'gemini-2.5-flash',
          finishReason: 'stop',
          promptTokens: 80,
          completionTokens: 30,
          totalTokens: 110,
          latency: 120,
          retries: 0,
          timeoutMs: 5000,
          gatewayVersion: 'v1.0.0'
        }
      })

      const result = await generateReinforcement('Cheesy Pizza', 'Food', {
        importance: 'Peace of mind'
      })

      expect(result.selected_option).toBe('Cheesy Pizza')
      expect(result.reasoning).toBe('Pizza brings delicious comfort when you need a pause.')
      expect(result.encouragement).toBe('Enjoy every slice! 🍕')
      expect(result.mascot).toBe('munch')
    })

    it('should throw error when LLMGateway fails (no silent fallback)', async () => {
      vi.spyOn(LLMGateway.prototype, 'generate').mockRejectedValueOnce(
        new GatewayError('timeout', 'LLM request timed out.')
      )

      await expect(generateReinforcement('Cheesy Pizza', 'Food')).rejects.toThrow(
        'LLM request timed out.'
      )
    })
  })

  describe('generateReinforcementWithReasoning', () => {
    it('should successfully parse reasoning-backed reinforcement response from LLMGateway', async () => {
      const mockResult = {
        selected_option: 'Cheesy Pizza',
        reasoning: 'Based on your energy level, pizza is the coziest choice.',
        encouragement: 'Take it easy today! 🍀',
        follow_up_question: 'Ready to order?',
        mascot: 'pandy'
      }

      vi.spyOn(LLMGateway.prototype, 'generate').mockResolvedValueOnce({
        requestId: 'test-req-3',
        text: `\`\`\`json\n${JSON.stringify(mockResult)}\n\`\`\``,
        streamed: false,
        metrics: {
          providerId: 'gemini',
          modelId: 'gemini-2.5-flash',
          finishReason: 'stop',
          promptTokens: 100,
          completionTokens: 40,
          totalTokens: 140,
          latency: 150,
          retries: 0,
          timeoutMs: 5000,
          gatewayVersion: 'v1.0.0'
        }
      })

      const reasoningPackage: ReasoningPackage = {
        context: {
          user_id: 'user_123',
          user_input: 'Cheesy Pizza',
          options: ['Cheesy Pizza', 'Salad'],
          profile_beliefs: [],
          relevant_memories: [],
          decision_history: []
        },
        observations: [],
        conflicts: [],
        uncertainties: []
      }

      const result = await generateReinforcementWithReasoning(
        reasoningPackage,
        'Cheesy Pizza',
        'Food',
        'Alex',
        'Alex'
      )

      expect(result.selected_option).toBe('Cheesy Pizza')
      expect(result.reasoning).toBe('Based on your energy level, pizza is the coziest choice.')
      expect(result.mascot).toBe('pandy')
    })

    it('should throw error when LLMGateway fails with reasoning (no silent fallback)', async () => {
      vi.spyOn(LLMGateway.prototype, 'generate').mockRejectedValueOnce(
        new GatewayError('unavailable', 'Service unavailable')
      )

      const reasoningPackage: ReasoningPackage = {
        context: {
          user_id: 'user_123',
          user_input: 'Cheesy Pizza',
          options: ['Cheesy Pizza', 'Salad'],
          profile_beliefs: [],
          relevant_memories: [],
          decision_history: []
        },
        observations: [],
        conflicts: [],
        uncertainties: []
      }

      await expect(
        generateReinforcementWithReasoning(reasoningPackage, 'Cheesy Pizza', 'Food')
      ).rejects.toThrow('Service unavailable')
    })
  })
})
