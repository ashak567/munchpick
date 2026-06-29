import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { ResponseValidator } from './validator';
import { ResponseValidatorInput, RetryHints } from './types';
import { PromptPackage, ResponsePlan, PersonalityDecision, MascotDecision } from '../reflection/types';
import { GatewayResponse } from '../llm/types';
import { PromptBuilderEngine } from '../reflection/prompt-builder';
import { PIPELINE_VERSION } from '../reflection/speculative';

function getMockPromptPackage(): PromptPackage {
  return {
    version: 'v1.7.0',
    templateVersion: 'v1.0.0',
    renderStrategy: 'comfort',
    directives: { mustDo: [], shouldDo: [], avoid: [] },
    sections: [],
    estimatedTokens: 0,
    statistics: { sections: 0, estimatedTokens: 0, checksum: 'mock-sum', compressionRatio: 1.0 },
    checksum: 'mock-sum',
    isIncomplete: false
  };
}

function getMockGatewayResponse(text: string): GatewayResponse {
  return {
    requestId: 'mock-request-id',
    text,
    metrics: {
      providerId: 'gemini',
      modelId: 'gemini-3.5-flash',
      finishReason: 'stop',
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
      latency: 150,
      retries: 0,
      timeoutMs: 5000,
      gatewayVersion: 'v1.0.0'
    },
    streamed: false
  };
}

describe('Response Validator Engine Tests', () => {
  const validator = new ResponseValidator();

  it('should pass validation on excellent, compliant response', () => {
    const gatewayResponse = getMockGatewayResponse("I hear how heavy this feels, friend. *pats shoulder gently* I'm right here with you. What else is on your mind?");
    const promptPackage = getMockPromptPackage();

    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage,
      personalityDecision: {
        dominantTrait: 'empathetic',
        communicationStyle: 'gentle',
        energyLevel: 'medium',
        expressionIntensity: 'medium',
        humorAllowed: false,
        useMetaphors: false,
        validateEmotion: true,
        challengeUser: false,
        confidence: 0.9,
        stability: 0.9,
        supportingTraits: [],
        responseConstraints: { avoidHumor: true, avoidLongReplies: true, avoidQuestions: false, avoidChallenges: false }
      },
      responsePlan: {
        responseGoal: 'comfort',
        primaryTopic: 'Topic A',
        secondaryTopics: [],
        sections: [],
        requiredReferences: { story: false, memory: false, emotion: true },
        forbiddenReferences: { memory: false, story: false, humor: false },
        transitionHints: [],
        maxQuestions: 1,
        endingStyle: 'warm',
        confidence: 0.9
      },
      mascotDecision: {
        mascotId: 'pandy',
        identity: 'Pandy comfort mascot',
        behavior: 'comforting',
        speakingStyle: 'warm',
        emotionalStyle: 'very warm',
        interactionStyle: 'comfort-first'
      }
    };

    const result = validator.validate(input);
    expect(result.passed).toBe(true);
    expect(result.validationScore).toBe(100);
    expect(result.issues.length).toBe(0);
    expect(result.metrics.responseHash.length).toBe(64); // SHA-256 hex length
  });

  it('should fail validation on empty response (critical severity)', () => {
    const gatewayResponse = getMockGatewayResponse("");
    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage: getMockPromptPackage()
    };

    const result = validator.validate(input);
    expect(result.passed).toBe(false);
    expect(result.validationScore).toBe(70); // Starts at 100, critical empty response deducts 30
    expect(result.issues.some(i => i.id === 'struct-empty')).toBe(true);
    expect(result.highestSeverity).toBe('critical');
  });

  it('should flag truncated response endings (high severity)', () => {
    const gatewayResponse = getMockGatewayResponse("This response is unfinished and cu");
    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage: getMockPromptPackage()
    };

    const result = validator.validate(input);
    expect(result.passed).toBe(true); // Score is 85 (100 - 15), no critical errors, so passed is true
    expect(result.validationScore).toBe(85);
    expect(result.issues.some(i => i.id === 'struct-truncated')).toBe(true);
    expect(result.highestSeverity).toBe('high');
    
    // Check retry hint extraction
    const hints = validator.compileRetryHints(result.issues);
    expect(hints.improveFormatting).toBe(true);
  });

  it('should flag duplicate paragraphs (high severity)', () => {
    const text = "First paragraph here.\n\nFirst paragraph here.";
    const gatewayResponse = getMockGatewayResponse(text);
    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage: getMockPromptPackage()
    };

    const result = validator.validate(input);
    expect(result.passed).toBe(true); // 85 score, passed is true
    expect(result.issues.some(i => i.id === 'quality-duplicate-paragraph')).toBe(true);
  });

  it('should violate planning constraints if question limit is exceeded (high severity)', () => {
    const gatewayResponse = getMockGatewayResponse("How are you? Are you feeling okay? What can I do for you?");
    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage: getMockPromptPackage(),
      responsePlan: {
        responseGoal: 'comfort',
        primaryTopic: 'Topic A',
        secondaryTopics: [],
        sections: [],
        requiredReferences: { story: false, memory: false, emotion: false },
        forbiddenReferences: { memory: false, story: false, humor: false },
        transitionHints: [],
        maxQuestions: 1, // Plan limit is 1
        endingStyle: 'warm',
        confidence: 0.9
      }
    };

    const result = validator.validate(input);
    expect(result.issues.some(i => i.id === 'plan-question-limit')).toBe(true);
    const hints = validator.compileRetryHints(result.issues);
    expect(hints.reduceQuestions).toBe(true);
  });

  it('should violate personality style if humor is disallowed but detected (medium severity)', () => {
    const gatewayResponse = getMockGatewayResponse("That is so funny! Haha, just kidding!");
    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage: getMockPromptPackage(),
      personalityDecision: {
        dominantTrait: 'calm',
        communicationStyle: 'gentle',
        energyLevel: 'low',
        expressionIntensity: 'low',
        humorAllowed: false, // Humor disallowed
        useMetaphors: true,
        validateEmotion: false,
        challengeUser: false,
        confidence: 0.9,
        stability: 0.9,
        supportingTraits: [],
        responseConstraints: { avoidHumor: true, avoidLongReplies: false, avoidQuestions: false, avoidChallenges: false }
      }
    };

    const result = validator.validate(input);
    expect(result.issues.some(i => i.id === 'style-humor-disallowed')).toBe(true);
    const hints = validator.compileRetryHints(result.issues);
    expect(hints.removeHumor).toBe(true);
  });

  it('should fail validation with critical safety error if raw internal terms are leaked', () => {
    const gatewayResponse = getMockGatewayResponse("My reflection engine computed a readiness score of 0.85.");
    const input: ResponseValidatorInput = {
      gatewayResponse,
      promptPackage: getMockPromptPackage()
    };

    const result = validator.validate(input);
    expect(result.passed).toBe(false);
    expect(result.issues.some(i => i.id === 'safety-leakage-internal')).toBe(true);
    expect(result.highestSeverity).toBe('critical');
  });

  it('should successfully feed retry hints into PromptBuilderEngine directives', async () => {
    const builder = new PromptBuilderEngine();
    const trace = {
      state: 'Listening' as const,
      emotions: [],
      reflections: [],
      readinessScore: 0.5,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch' as const,
      mascotExpression: 'idle' as const,
      mascotReason: 'Default Mascot',
      generatedPaths: [],
      confidence: 0.9,
      activeTopicKey: 'topic_a',
      // Attach retry hints to trace
      retryHints: {
        shorten: true,
        removeHumor: true,
        reduceQuestions: true,
        strengthenEmpathy: true,
        improveFormatting: true
      }
    };

    const resultTrace = await builder.execute(trace as any, {
      user_id: 'user_123',
      user_input: 'Hello',
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: []
    });

    const directives = resultTrace.promptPackage?.directives;
    expect(directives).toBeDefined();
    expect(directives?.mustDo).toContain('Keep output extremely brief (target 1 sentence, under 20 words).');
    expect(directives?.mustDo).toContain('Deliver extremely validating, supportive and comforting comments.');
    expect(directives?.mustDo).toContain('Strictly output correct and properly balanced markdown block syntax.');
    expect(directives?.avoid).toContain('Strictly avoid all jokes, humor, and lighthearted comments.');
    expect(directives?.avoid).toContain('Do not ask any questions.');
  });

  it('should play nicely with pipeline versions', () => {
    expect(PIPELINE_VERSION).toBe('v1.8.0');
  });
});
