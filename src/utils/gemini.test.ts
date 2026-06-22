import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { classifyOptions, generateReinforcement } from './gemini'

// Mock GoogleGenerativeAI
const mockGenerateContent = vi.fn()

vi.mock('@google/generative-ai', () => {
  class MockGoogleGenerativeAI {
    constructor(public apiKey: string) {}
    getGenerativeModel = vi.fn().mockImplementation(() => {
      return {
        generateContent: mockGenerateContent,
      }
    })
  }
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI
  }
})

describe('Gemini Integration & Fallback Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Fallback Pipeline (No API Key)', () => {
    it('should classify food options correctly via regex fallback', async () => {
      delete process.env.GEMINI_API_KEY
      const options = ['Delicious Cheesy Pizza', 'Tasty Salmon Sushi']
      const result = await classifyOptions(options)
      
      expect(result.category).toBe('Food')
      expect(result.options).toHaveLength(2)
      expect(result.options[0].text).toBe('Delicious Cheesy Pizza')
      // Word tags of length > 3
      expect(result.options[0].tags).toContain('delicious')
      expect(result.options[0].tags).toContain('cheesy')
      expect(result.options[0].tags).toContain('pizza')
    })

    it('should classify entertainment options correctly via regex fallback', async () => {
      delete process.env.GEMINI_API_KEY
      const options = ['Watch Netflix movie', 'Play video game']
      const result = await classifyOptions(options)
      
      expect(result.category).toBe('Entertainment')
    })

    it('should fallback to Category: Other if no keyword matches', async () => {
      delete process.env.GEMINI_API_KEY
      const options = ['Solve puzzle', 'Fix chair']
      const result = await classifyOptions(options)
      
      expect(result.category).toBe('Other')
    })

    it('should generate fallback reinforcement message and reasons for Food category', async () => {
      delete process.env.GEMINI_API_KEY
      const result = await generateReinforcement('Fresh Spicy Tuna Sushi', 'Food')
      
      expect(result.reasoning).toContain('warm is a wonderful place')
      expect(result.encouragement).toContain('🍕')
      expect(result.follow_up_question).toBeDefined()
    })

    it('should generate fallback reinforcement message and reasons for Other category', async () => {
      delete process.env.GEMINI_API_KEY
      const result = await generateReinforcement('Fix chair', 'Other')
      
      expect(result.reasoning).toContain('good place to begin')
      expect(result.encouragement).toContain('🍀')
      expect(result.follow_up_question).toBeDefined()
    })
  })

  describe('Primary AI Pipeline (With API Key & Mocked Responses)', () => {
    it('should call Gemini API and parse the response for classification', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      
      const mockResult = {
        category: 'Shopping',
        options: [
          { text: 'Buy shoes', tags: ['footwear', 'shopping'] },
          { text: 'Buy jacket', tags: ['apparel', 'winter'] }
        ]
      }
      
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockResult)
        }
      })

      const options = ['Buy shoes', 'Buy jacket']
      const result = await classifyOptions(options)

      expect(result.category).toBe('Shopping')
      expect(result.options[0].tags).toContain('footwear')
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('should call Gemini API and parse response for reinforcement', async () => {
      process.env.GEMINI_API_KEY = 'test_key'

      const mockResult = {
        selected_option: 'Buy shoes',
        reasoning: 'Reason one and Reason two.',
        encouragement: 'Supportive statement! 🎉',
        follow_up_question: 'How do you feel?',
        mascot: 'ollie'
      }

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(mockResult)
        }
      })

      const result = await generateReinforcement('Buy shoes', 'Shopping')

      expect(result.reasoning).toBe('Reason one and Reason two.')
      expect(result.encouragement).toContain('🎉')
      expect(result.follow_up_question).toBe('How do you feel?')
      expect(result.mascot).toBe('ollie')
      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    })

    it('should trigger fallback if Gemini API times out or throws error', async () => {
      process.env.GEMINI_API_KEY = 'test_key'
      
      // Simulate Gemini failure
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error'))

      const options = ['Delicious Cheesy Pizza', 'Tasty Salmon Sushi']
      const result = await classifyOptions(options)

      // Should fall back gracefully to Food category
      expect(result.category).toBe('Food')
    })
  })
})
