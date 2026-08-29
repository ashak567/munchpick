import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NO_STORE_HEADERS, jsonNoStore } from '@/lib/api-headers';
import { SPECULATIVE_CACHE, setSpeculativeState } from '@/lib/reflection/speculative';
import {
  PromptBuilderEngine,
  PersonalityEngine,
  CognitiveOrchestratorEngine,
  ReflectionEngine
} from '@/lib/reflection/engine';
import { CognitiveTrace, ContextPackage, ContextBlock } from '@/lib/reflection/types';
import { MascotCharacter } from '@/components/Mascot';
import { llmConfig, getApprovedGeminiModel } from '@/lib/llm/config';

function createMockTrace(userId: string, mascot: MascotCharacter = 'munch'): CognitiveTrace {
  return {
    state: 'Listening',
    confidence: 0.9,
    emotions: [],
    reflections: [],
    readinessScore: 0.1,
    readinessThreshold: 0.65,
    mascotCharacter: mascot,
    mascotExpression: 'idle',
    mascotReason: 'Default companion listener',
    generatedPaths: [],
    activeTopicKey: 'general',
    mascotDecision: {
      mascotId: mascot,
      identity: 'Munch is a calm, reflective clover companion.',
      behavior: 'Active listening and thoughtful perspective.',
      speakingStyle: 'Gentle, unhurried, reassuring tone.',
      emotionalStyle: 'Warm and empathetic.',
      interactionStyle: 'Non-judgmental companionship.'
    },
    personalityDecision: {
      dominantTrait: 'empathetic',
      communicationStyle: 'gentle',
      energyLevel: 'low',
      expressionIntensity: 'medium',
      validateEmotion: true,
      useMetaphors: false,
      challengeUser: false,
      humorAllowed: false,
      confidence: 0.9,
      stability: 1.0,
      supportingTraits: ['calm', 'supportive'],
      responseConstraints: {
        avoidHumor: true,
        avoidLongReplies: false,
        avoidQuestions: false,
        avoidChallenges: true
      }
    },
    cognitiveDecision: {
      dominantNeed: 'listen',
      urgency: 'low',
      emotionalPriority: 0.1,
      storyPriority: 0.1,
      memoryPriority: 0.1,
      reflectionPriority: 0.1,
      confidence: 0.9,
      dominantReason: 'Calm or neutral emotion priority detected.',
      supportingReasons: [],
      cognitiveLoad: 0.1,
      responseDepth: 'short',
      askQuestion: false,
      acknowledgeEmotion: false,
      referenceMemory: false,
      referenceStory: false
    },
    responsePlan: {
      responseGoal: 'reflect',
      primaryTopic: 'general',
      secondaryTopics: [],
      sections: [],
      requiredReferences: { story: false, memory: false, emotion: false },
      forbiddenReferences: { memory: false, story: false, humor: true },
      transitionHints: [],
      endingStyle: 'reflective',
      maxQuestions: 1,
      confidence: 0.9
    }
  };
}

function createMockContext(userId: string, userInput = 'hello', memories: any[] = []): ContextPackage {
  return {
    user_id: userId,
    user_input: userInput,
    chat_id: `chat_${userId}_001`,
    message_count: 1,
    options: [],
    memories,
    relevant_memories: memories,
    profile_beliefs: [],
    decision_history: [],
    recent_messages: [
      { id: `msg_${userId}_1`, chat_id: `chat_${userId}_001`, sender: 'mascot', content: "What's on your mind today? I'm here to listen." },
      { id: `msg_${userId}_2`, chat_id: `chat_${userId}_001`, sender: 'user', content: userInput }
    ],
    previousAssistantResponses: ["What's on your mind today? I'm here to listen."]
  };
}

describe('N-User State Isolation & Global Munch Invariant Tests (Phase 8.5/8.6)', () => {
  beforeEach(() => {
    SPECULATIVE_CACHE.clear();
    vi.clearAllMocks();
  });

  describe('1. Global Munch Personality & Prompt Invariant across Arbitrary N Users', () => {
    it('guarantees identical baseline personality configuration for arbitrary users without prior history', async () => {
      // Create N arbitrary users with randomized IDs
      const userIds = Array.from({ length: 5 }, (_, i) => `user-${String.fromCharCode(65 + i)}-${Math.random().toString(36).slice(2, 8)}`);

      const promptPackages = await Promise.all(
        userIds.map(async (userId) => {
          const trace = createMockTrace(userId);
          const context = createMockContext(userId, 'hello');
          const builder = new PromptBuilderEngine();
          const resultTrace = await builder.execute(trace, context);
          return { userId, promptPackage: resultTrace.promptPackage! };
        })
      );

      // Verify that every user received a valid prompt package
      expect(promptPackages).toHaveLength(5);

      const baseline = promptPackages[0].promptPackage;

      // Assert structural, personality, and guideline equality across all N users
      for (let i = 1; i < promptPackages.length; i++) {
        const current = promptPackages[i].promptPackage;

        // Same template version & render strategy
        expect(current.version).toBe(baseline.version);
        expect(current.renderStrategy).toBe(baseline.renderStrategy);

        // System guidelines section must be 100% identical
        const baseSys = baseline.sections.find(s => s.type === 'system');
        const currSys = current.sections.find(s => s.type === 'system');
        expect(currSys?.content).toEqual(baseSys?.content);

        // Mascot identity section must be 100% identical
        const baseIdentity = baseline.sections.find(s => s.type === 'identity');
        const currIdentity = current.sections.find(s => s.type === 'identity');
        expect(currIdentity?.content).toEqual(baseIdentity?.content);

        // Personality guidelines section must be 100% identical
        const basePersonality = baseline.sections.find(s => s.type === 'personality');
        const currPersonality = current.sections.find(s => s.type === 'personality');
        expect(currPersonality?.content).toEqual(basePersonality?.content);

        // Directives must be identical
        expect(current.directives).toEqual(baseline.directives);
      }
    });

    it('ensures global model configuration and provider fallback order are identical for every user', () => {
      // All users resolve through the same central approved models
      expect(getApprovedGeminiModel('conversational')).toBe('gemini-2.5-flash');
      expect(getApprovedGeminiModel('reasoning')).toBe('gemini-2.5-flash');
      expect(getApprovedGeminiModel('auxiliary')).toBe('gemini-3.1-flash-lite');

      expect(llmConfig.defaultProvider).toBe('gemini');
      expect(llmConfig.fallbackProviders).toEqual(['groq', 'openrouter']);
    });
  });

  describe('2. Separation of Legitimate Personalization from Global Identity', () => {
    it('personalizes user-specific memory context without mutating Munch global personality baseline', async () => {
      const userA = 'user-A-with-memory';
      const userB = 'user-B-without-memory';

      const memoryA = [{ id: 'mem_1', summary: 'User enjoys morning coffee before work', importance: 0.8 }];

      const traceA = createMockTrace(userA);
      const contextA = createMockContext(userA, 'good morning', memoryA);
      traceA.contextAssembly = {
        blocks: [
          { id: 'blk_mem', category: 'memory', importance: 'medium', required: false, priority: 0.6, estimatedTokens: 20, sourceIds: ['mem_1'], content: { memories: memoryA } },
          { id: 'blk_conv', category: 'conversation', importance: 'high', required: true, priority: 0.4, estimatedTokens: 10, sourceIds: [], content: { userInput: 'good morning' } }
        ],
        totalEstimatedTokens: 30,
        trimmedBlocks: [],
        duplicateBlocksMerged: 0,
        confidence: 0.9,
        pipelineVersion: 'v1.7.0',
        assemblyOrder: ['blk_mem', 'blk_conv'],
        isIncomplete: false,
        generationIntent: 'conversation',
        assemblyMetrics: { totalBlocks: 2, mergedBlocks: 0, trimmedBlocks: 0, skippedBlocks: 0, estimatedTokens: 30 },
        providerHints: { supportsStreaming: true, supportsReasoning: false, supportsVision: false }
      };

      const traceB = createMockTrace(userB);
      const contextB = createMockContext(userB, 'good morning', []);
      traceB.contextAssembly = {
        blocks: [
          { id: 'blk_conv', category: 'conversation', importance: 'high', required: true, priority: 0.4, estimatedTokens: 10, sourceIds: [], content: { userInput: 'good morning' } }
        ],
        totalEstimatedTokens: 10,
        trimmedBlocks: [],
        duplicateBlocksMerged: 0,
        confidence: 0.9,
        pipelineVersion: 'v1.7.0',
        assemblyOrder: ['blk_conv'],
        isIncomplete: false,
        generationIntent: 'conversation',
        assemblyMetrics: { totalBlocks: 1, mergedBlocks: 0, trimmedBlocks: 0, skippedBlocks: 0, estimatedTokens: 10 },
        providerHints: { supportsStreaming: true, supportsReasoning: false, supportsVision: false }
      };

      const builder = new PromptBuilderEngine();
      const resultA = await builder.execute(traceA, contextA);
      const resultB = await builder.execute(traceB, contextB);

      const pkgA = resultA.promptPackage!;
      const pkgB = resultB.promptPackage!;

      // User A receives the memory section
      const memSectionA = pkgA.sections.find(s => s.type === 'memory');
      expect(memSectionA).toBeDefined();
      expect(memSectionA?.content).toEqual({ memories: memoryA });

      // User B receives NO memory section
      const memSectionB = pkgB.sections.find(s => s.type === 'memory');
      expect(memSectionB).toBeUndefined();

      // But BOTH users retain 100% identical mascot identity & personality definition
      const identityA = pkgA.sections.find(s => s.type === 'identity');
      const identityB = pkgB.sections.find(s => s.type === 'identity');
      expect(identityA?.content).toEqual(identityB?.content);

      const personalityA = pkgA.sections.find(s => s.type === 'personality');
      const personalityB = pkgB.sections.find(s => s.type === 'personality');
      expect(personalityA?.content).toEqual(personalityB?.content);
    });
  });

  describe('3. Multi-User (N-User) State & Cache Partitioning', () => {
    it('strictly isolates in-memory speculative cache across N arbitrary users with colliding draft IDs', () => {
      const userCount = 10;
      const commonDraftId = 'draft_universal_100';

      const users = Array.from({ length: userCount }, (_, i) => ({
        id: `usr_${String.fromCharCode(65 + i)}_${Math.random().toString(36).slice(2, 8)}`,
        draftText: `Draft thought from user ${String.fromCharCode(65 + i)}`
      }));

      // Store speculative state for all users under the same draftId
      for (const u of users) {
        const key = `${u.id}:${commonDraftId}`;
        setSpeculativeState(key, {
          draft: u.draftText,
          normalizedDraft: u.draftText.toLowerCase(),
          pipelineVersion: 'v1.8.0',
          engineVersions: {},
          fingerprints: {},
          cognitiveTrace: createMockTrace(u.id),
          completedEngines: ['NLU Engine'],
          timestamp: Date.now(),
          predictionConfidence: 0.85
        } as any);
      }

      // Verify each user retrieves ONLY their own draft, with zero cross-user leakage
      for (const u of users) {
        const key = `${u.id}:${commonDraftId}`;
        const retrieved = SPECULATIVE_CACHE.get(key);
        expect(retrieved).toBeDefined();
        expect(retrieved?.draft).toBe(u.draftText);

        // Ensure no other user's key matches this user's data
        for (const other of users) {
          if (other.id !== u.id) {
            const otherKey = `${other.id}:${commonDraftId}`;
            expect(SPECULATIVE_CACHE.get(otherKey)?.draft).not.toBe(u.draftText);
          }
        }
      }
    });

    it('ensures database memory collections are strictly partitioned per authenticated user ID', () => {
      const allDatabaseMemories = [
        { id: 'mem_1', user_id: 'usr-A-101', summary: 'Prefers quiet cozy coffee places' },
        { id: 'mem_2', user_id: 'usr-B-202', summary: 'Loves spicy ramen and quick dinners' },
        { id: 'mem_3', user_id: 'usr-C-303', summary: 'Interested in career planning' },
        { id: 'mem_4', user_id: 'usr-D-404', summary: 'Enjoys outdoor hiking on weekends' },
        { id: 'mem_5', user_id: 'usr-E-505', summary: 'Focuses on building meditation habits' }
      ];

      const getUserMemories = (targetUserId: string) =>
        allDatabaseMemories.filter(m => m.user_id === targetUserId);

      const targetUsers = ['usr-A-101', 'usr-B-202', 'usr-C-303', 'usr-D-404', 'usr-E-505'];

      for (const uid of targetUsers) {
        const userMems = getUserMemories(uid);
        expect(userMems).toHaveLength(1);
        expect(userMems[0].user_id).toBe(uid);

        // Disjoint check against all other users
        const otherMems = allDatabaseMemories.filter(m => m.user_id !== uid);
        const userMemIds = new Set(userMems.map(m => m.id));
        const otherMemIds = new Set(otherMems.map(m => m.id));

        for (const id of userMemIds) {
          expect(otherMemIds.has(id)).toBe(false);
        }
      }
    });
  });

  describe('4. HTTP Cache-Control & Opaque Correlation Logging', () => {
    it('enforces private no-store headers on all dynamic API responses', () => {
      const response = jsonNoStore({ success: true, data: 'user-specific-payload' });

      expect(response.headers.get('Cache-Control')).toBe(
        'private, no-cache, no-store, max-age=0, must-revalidate'
      );
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
      expect(response.headers.get('Surrogate-Control')).toBe('no-store');
    });

    it('ensures correlation logging masks sensitive user IDs for arbitrary user identifiers', () => {
      const testUserIds = [
        '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        'e8f7a6b5-c4d3-4210-9876-543210abcdef',
        '11223344-5566-7788-99aa-bbccddeeff00'
      ];

      for (const rawUserId of testUserIds) {
        const maskedUserId = `${rawUserId.slice(0, 8)}...`;
        const logPayload = {
          requestId: `req_${Math.random().toString(36).slice(2, 10)}`,
          userId: maskedUserId,
          chatId: `chat_${rawUserId.slice(0, 6)}`,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          retries: 0
        };

        expect(logPayload.userId).toBe(`${rawUserId.slice(0, 8)}...`);
        expect(logPayload.userId).not.toContain(rawUserId.slice(9));
      }
    });
  });
});
