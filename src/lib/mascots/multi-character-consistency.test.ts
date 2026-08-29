import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MASCOT_REGISTRY, MascotCharacter } from './registry';
import {
  runCognitivePipeline,
  NluEnginePlugin,
  EmotionEnginePlugin,
  MascotSpecialistEngine,
  ReflectionEngine,
  StoryEngine,
  StoryEventsEngine,
  StoryProgressEngine,
  StoryIntelligenceEngine,
  MemoryConsolidationEngine,
  CognitiveOrchestratorEngine,
  PersonalityEngine,
  ResponsePlanningEngine,
  ContextAssemblyEngine,
  PromptBuilderEngine
} from '@/lib/reflection/engine';
import { EmotionalStateEngine } from '@/lib/emotion/state';
import { EmotionRegulationEngine } from '@/lib/emotion/regulation';
import { EmotionDynamicsEngine } from '@/lib/emotion/dynamics';
import { DecisionReadinessEngine } from '@/lib/reflection/readiness';
import { MunchContextBuilder } from '@/lib/context/builder';
import { LLMGateway } from '@/lib/llm/gateway';
import { ResponseValidator } from '@/lib/validation/validator';
import { ResponseExpressionEngine } from '@/lib/expression/engine';
import { CognitiveTrace } from '@/lib/reflection/types';
import { ProviderResolver } from '@/lib/llm/resolver';
import { LLMProvider, LLMRequest, LLMResponse } from '@/lib/llm/types';
import { analyzeContextFallback } from '@/lib/nlu/fallback';

// Mock Supabase server client
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null })
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
    }
  }))
}));

// Mock NLU pipeline to use deterministic fallback analyzer in unit tests
vi.mock('@/lib/nlu/pipeline', () => ({
  runNLUPipeline: vi.fn().mockImplementation(async (ctx: any) => analyzeContextFallback(ctx))
}));

// Mock analyzeTopics to return deterministic structured topics immediately without network delay
vi.mock('@/lib/context/builder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/context/builder')>();
  return {
    ...actual,
    analyzeTopics: vi.fn().mockImplementation(async (input: string) => {
      return actual.getFallbackTopicAnalysis(input);
    })
  };
});

const ALL_CHARACTERS: MascotCharacter[] = [
  'munch',
  'ollie',
  'ellie',
  'pandy',
  'dobby',
  'coco',
  'froggy',
  'bubbles',
  'chicky'
];

describe('Multi-Character Conversational Consistency & Isolation Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies all 9 characters are registered and distinct in MASCOT_REGISTRY', () => {
    expect(Object.keys(MASCOT_REGISTRY)).toHaveLength(9);
    for (const char of ALL_CHARACTERS) {
      const entry = MASCOT_REGISTRY[char];
      expect(entry).toBeDefined();
      expect(entry.id).toBe(char);
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.personality.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  // Step 8: Multi-Character 5-Turn Regression Test
  describe.each(ALL_CHARACTERS)('Character: %s', (character) => {
    it(`executes full 5-turn conversation maintaining identity, history, and context isolation for ${character}`, async () => {
      const turns = [
        "heyy whats up",
        "i'm actually having a pretty good day",
        "you know what, I've been working on something for weeks",
        "it finally started working",
        "do you want to hear what happened?"
      ];

      const conversationHistory: Array<{ sender: string; content: string }> = [];
      const assistantResponses: string[] = [];

      let previousStoryState: any = undefined;
      let previousStoryProgress: any = undefined;
      let previousStoryInsight: any = undefined;
      let previousMemoryState: any = undefined;
      let previousCognitiveDecision: any = undefined;
      let previousPersonalityDecision: any = undefined;

      const contextBuilder = new MunchContextBuilder();
      const validator = new ResponseValidator();
      const expressionEngine = new ResponseExpressionEngine();

      for (let i = 0; i < turns.length; i++) {
        const currentInput = turns[i];

        // 1. Build Context
        const context = await contextBuilder.buildContext({
          user_id: 'audit-user-123',
          user_input: currentInput,
          options: [],
          topic_analysis: { active_topics: ['general'], intent_hints: [] }
        });

        context.chatHistory = [...conversationHistory];
        context.previousAssistantResponses = [...assistantResponses];
        context.previousStoryState = previousStoryState;
        context.previousStoryProgress = previousStoryProgress;
        context.previousStoryInsight = previousStoryInsight;
        context.previousMemoryState = previousMemoryState;
        context.previousCognitiveDecision = previousCognitiveDecision;
        context.previousPersonalityDecision = previousPersonalityDecision;

        // 2. Initialize Trace seeded with this specific character
        const initialTrace: CognitiveTrace = {
          state: 'Listening',
          emotions: [],
          reflections: [],
          readinessScore: 0.0,
          readinessThreshold: 0.65,
          mascotCharacter: character,
          mascotExpression: 'idle',
          mascotReason: `Active session character: ${character}`,
          generatedPaths: [],
          confidence: 1.0,
          activeTopicKey: 'general',
          storyState: previousStoryState,
          storyProgress: previousStoryProgress,
          storyInsight: previousStoryInsight,
          memoryState: previousMemoryState,
          cognitiveDecision: previousCognitiveDecision,
          personalityDecision: previousPersonalityDecision
        };

        // 3. Run the Common Cognitive Pipeline
        const pipeline = [
          new NluEnginePlugin(),
          new EmotionEnginePlugin(),
          new EmotionalStateEngine(),
          new EmotionRegulationEngine(),
          new EmotionDynamicsEngine(),
          new StoryEngine(),
          new StoryEventsEngine(),
          new StoryProgressEngine(),
          new StoryIntelligenceEngine(),
          new MemoryConsolidationEngine(),
          new CognitiveOrchestratorEngine(),
          new PersonalityEngine(),
          new ResponsePlanningEngine(),
          new ReflectionEngine(),
          new ContextAssemblyEngine(),
          new DecisionReadinessEngine(),
          new MascotSpecialistEngine(),
          new PromptBuilderEngine()
        ];

        const finalTrace = await runCognitivePipeline(pipeline, initialTrace, context);

        // Assert Pipeline & Prompt Integrity
        expect(finalTrace.mascotCharacter).toBe(character);
        expect(finalTrace.mascotDecision?.mascotId).toBe(character);
        expect(finalTrace.personalityDecision?.mascotId).toBe(character);
        expect(finalTrace.promptPackage).toBeDefined();

        const sections = finalTrace.promptPackage!.sections;

        // Assert CURRENT_USER_MESSAGE isolation
        const currentMsgSection = sections.find(s => s.id === 'current_user_message');
        expect(currentMsgSection).toBeDefined();
        expect(currentMsgSection!.content).toBe(currentInput);

        // Assert Identity section matches the character
        const identitySection = sections.find(s => s.id === `mascot_identity_${character}`);
        expect(identitySection).toBeDefined();
        expect((identitySection!.content as any).mascotId).toBe(character);

        // Assert History availability for turns > 0
        if (i > 0) {
          const historySection = sections.find(s => s.id === 'recent_conversation_history');
          expect(historySection).toBeDefined();
          expect(Array.isArray(historySection!.content)).toBe(true);

          const forbiddenSection = sections.find(s => s.id === 'forbidden_previous_responses');
          expect(forbiddenSection).toBeDefined();
        }

        // 4. Simulate Character Response Voice
        const sampleResponse = `Hello there! I am listening attentively to your thoughts about turn ${i + 1}.`;
        const validatorInput = {
          gatewayResponse: {
            requestId: `req-${i}`,
            text: sampleResponse,
            metrics: {
              providerId: 'gemini',
              modelId: 'gemini-2.5-flash',
              finishReason: 'stop',
              promptTokens: 100,
              completionTokens: 20,
              totalTokens: 120,
              latency: 150,
              retries: 0,
              timeoutMs: 5000,
              gatewayVersion: 'v1.1.0'
            },
            streamed: false
          },
          promptPackage: finalTrace.promptPackage!,
          responsePlan: finalTrace.responsePlan,
          personalityDecision: finalTrace.personalityDecision,
          mascotDecision: finalTrace.mascotDecision,
          contextAssembly: finalTrace.contextAssembly,
          previousAssistantResponses: assistantResponses
        };

        const validationResult = validator.validate(validatorInput);
        expect(validationResult.passed).toBe(true);

        // 5. Expression Engine execution
        const exprResult = expressionEngine.execute({
          validatedResponse: sampleResponse,
          profile: {
            mascotId: character,
            dominantTrait: finalTrace.personalityDecision?.dominantTrait || 'calm',
            communicationStyle: finalTrace.personalityDecision?.communicationStyle || 'balanced',
            energyLevel: finalTrace.personalityDecision?.energyLevel || 'medium',
            expressionIntensity: finalTrace.personalityDecision?.expressionIntensity || 'medium',
            humorAllowed: finalTrace.personalityDecision?.humorAllowed ?? false,
            useMetaphors: finalTrace.personalityDecision?.useMetaphors ?? false
          },
          responsePlan: finalTrace.responsePlan
        });

        expect(exprResult.finalText).toBeDefined();
        expect(exprResult.metrics).toBeDefined();

        // Accumulate history
        conversationHistory.push({ sender: 'user', content: currentInput });
        conversationHistory.push({ sender: 'mascot', content: exprResult.finalText });
        assistantResponses.push(exprResult.finalText);

        previousStoryState = finalTrace.storyState;
        previousStoryProgress = finalTrace.storyProgress;
        previousStoryInsight = finalTrace.storyInsight;
        previousMemoryState = finalTrace.memoryState;
        previousCognitiveDecision = finalTrace.cognitiveDecision;
        previousPersonalityDecision = finalTrace.personalityDecision;
      }

      expect(conversationHistory).toHaveLength(10); // 5 user + 5 mascot
      expect(assistantResponses).toHaveLength(5);
    }, 30000);
  });

  // Step 9: Provider Fallback Compatibility Simulation
  describe('Provider Fallback Compatibility Simulation', () => {
    class MockProvider implements LLMProvider {
      constructor(
        public id: string,
        private handler: (req: LLMRequest) => Promise<LLMResponse>,
        private configured = true
      ) {}
      public validateCapabilities() { return true; }
      public isConfigured() { return this.configured; }
      public async generate(req: LLMRequest) { return this.handler(req); }
      public async *stream() { yield ''; }
    }

    it('preserves Ollie personality and character payload across Gemini -> Groq -> OpenRouter fallback', async () => {
      // 1. Setup Ollie Trace and Prompt Package
      const pipeline = [
        new NluEnginePlugin(),
        new EmotionEnginePlugin(),
        new EmotionalStateEngine(),
        new EmotionRegulationEngine(),
        new EmotionDynamicsEngine(),
        new StoryEngine(),
        new MemoryConsolidationEngine(),
        new CognitiveOrchestratorEngine(),
        new PersonalityEngine(),
        new ResponsePlanningEngine(),
        new ReflectionEngine(),
        new ContextAssemblyEngine(),
        new DecisionReadinessEngine(),
        new MascotSpecialistEngine(),
        new PromptBuilderEngine()
      ];

      const initialTrace: CognitiveTrace = {
        state: 'Listening',
        emotions: ['reflective'],
        reflections: [],
        readinessScore: 0.0,
        readinessThreshold: 0.65,
        mascotCharacter: 'ollie',
        mascotExpression: 'idle',
        mascotReason: 'Session mascot: ollie',
        generatedPaths: [],
        confidence: 1.0,
        activeTopicKey: 'general'
      };

      const contextBuilder = new MunchContextBuilder();
      const context = await contextBuilder.buildContext({
        user_id: 'fallback-test-user',
        user_input: 'I have been reflecting on a big decision.',
        options: [],
        topic_analysis: { active_topics: ['decision'], intent_hints: [] }
      });

      const finalTrace = await runCognitivePipeline(pipeline, initialTrace, context);
      const pkg = finalTrace.promptPackage!;

      // Case 1: Gemini succeeds
      const resolver1 = new ProviderResolver();
      resolver1.registerProvider(new MockProvider('gemini', async () => ({
        text: 'What thoughts come to mind when you look at it from another angle?',
        finishReason: 'stop',
        promptTokens: 50,
        completionTokens: 15
      })));

      const gateway1 = new LLMGateway();
      (gateway1 as any).resolver = resolver1;
      const res1 = await gateway1.generate({ promptPackage: pkg });
      expect(res1.metrics.providerId).toBe('gemini');
      expect(res1.text).toContain('another angle');

      // Case 2: Gemini 429 -> Groq succeeds
      const resolver2 = new ProviderResolver();
      resolver2.registerProvider(new MockProvider('gemini', async () => {
        throw new Error('429 Rate limit exceeded');
      }));
      resolver2.registerProvider(new MockProvider('groq', async () => ({
        text: 'Looking at this from a fresh perspective, what matters most to you?',
        finishReason: 'stop',
        promptTokens: 50,
        completionTokens: 15
      })));

      const gateway2 = new LLMGateway();
      (gateway2 as any).resolver = resolver2;
      const res2 = await gateway2.generate({ promptPackage: pkg });
      expect(res2.metrics.providerId).toBe('groq');
      expect(res2.text).toContain('fresh perspective');

      // Case 3: Gemini 429 -> Groq 429 -> OpenRouter succeeds
      const resolver3 = new ProviderResolver();
      resolver3.registerProvider(new MockProvider('gemini', async () => {
        throw new Error('429 Rate limit exceeded on gemini');
      }));
      resolver3.registerProvider(new MockProvider('groq', async () => {
        throw new Error('429 Rate limit exceeded on groq');
      }));
      resolver3.registerProvider(new MockProvider('openrouter', async () => ({
        text: 'From a wide vantage point, how do you see this unfolding?',
        finishReason: 'stop',
        promptTokens: 50,
        completionTokens: 15
      })));

      const gateway3 = new LLMGateway();
      (gateway3 as any).resolver = resolver3;
      const res3 = await gateway3.generate({ promptPackage: pkg });
      expect(res3.metrics.providerId).toBe('openrouter');
      expect(res3.text).toContain('vantage point');

      // Assert that character identity and prompt package remained unchanged across provider switches
      expect((pkg.sections.find(s => s.id === 'mascot_identity_ollie')!.content as any).mascotId).toBe('ollie');
    });
  });

  // Step 7: Character Switch Isolation
  describe('Character Switch Isolation (User A -> Character A -> new chat -> Character B)', () => {
    it('ensures switching characters in a new chat completely isolates identity, reflections, and state', async () => {
      const pipeline = [
        new NluEnginePlugin(),
        new EmotionEnginePlugin(),
        new EmotionalStateEngine(),
        new EmotionRegulationEngine(),
        new EmotionDynamicsEngine(),
        new StoryEngine(),
        new MemoryConsolidationEngine(),
        new CognitiveOrchestratorEngine(),
        new PersonalityEngine(),
        new ResponsePlanningEngine(),
        new ReflectionEngine(),
        new ContextAssemblyEngine(),
        new DecisionReadinessEngine(),
        new MascotSpecialistEngine(),
        new PromptBuilderEngine()
      ];

      const contextBuilder = new MunchContextBuilder();

      // Session 1: Character A = Dobby (Dog, high energy, motivational)
      const dobbyContext = await contextBuilder.buildContext({
        user_id: 'user-isolated-1',
        user_input: 'I feel lazy today.',
        options: [],
        topic_analysis: { active_topics: ['motivation'], intent_hints: [] }
      });

      const dobbyTrace = await runCognitivePipeline(pipeline, {
        state: 'Listening',
        emotions: ['low_energy'],
        reflections: [],
        readinessScore: 0.0,
        readinessThreshold: 0.65,
        mascotCharacter: 'dobby',
        mascotExpression: 'idle',
        mascotReason: 'Session: dobby',
        generatedPaths: [],
        confidence: 1.0,
        activeTopicKey: 'general'
      }, dobbyContext);

      expect(dobbyTrace.mascotCharacter).toBe('dobby');
      expect(dobbyTrace.personalityDecision?.dominantTrait).toBe('encouraging');
      expect(dobbyTrace.promptPackage?.sections.some(s => s.id === 'mascot_identity_dobby')).toBe(true);

      // Session 2: Fresh chat with Character B = Froggy (Frog, tranquil, calm, grounding)
      const froggyContext = await contextBuilder.buildContext({
        user_id: 'user-isolated-1',
        user_input: 'I feel busy.',
        options: [],
        topic_analysis: { active_topics: ['stress'], intent_hints: [] }
      });

      const froggyTrace = await runCognitivePipeline(pipeline, {
        state: 'Listening',
        emotions: ['busy'],
        reflections: [],
        readinessScore: 0.0,
        readinessThreshold: 0.65,
        mascotCharacter: 'froggy',
        mascotExpression: 'idle',
        mascotReason: 'Session: froggy',
        generatedPaths: [],
        confidence: 1.0,
        activeTopicKey: 'general'
      }, froggyContext);

      // Assert complete isolation
      expect(froggyTrace.mascotCharacter).toBe('froggy');
      expect(froggyTrace.personalityDecision?.dominantTrait).toBe('calm');
      expect(froggyTrace.promptPackage?.sections.some(s => s.id === 'mascot_identity_froggy')).toBe(true);
      expect(froggyTrace.promptPackage?.sections.some(s => s.id === 'mascot_identity_dobby')).toBe(false);
    });
  });
});
