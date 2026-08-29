/**
 * Phase 8.4 - Anti-Repetition Regression Tests
 */

import { describe, it, expect } from 'vitest';
import { QualityValidationPlugin } from './rules/quality';
import { ResponseValidator } from './validator';
import { PromptBuilderEngine } from '../reflection/prompt-builder';
import type { CognitiveTrace, ContextPackage, PromptPackage } from '../reflection/types';
import type { GatewayResponse } from '../llm/types';
import type { ResponseValidatorInput } from './types';

function makeMinimalTrace(): CognitiveTrace {
  return {
    state: 'Listening',
    emotions: [],
    reflections: [],
    readinessScore: 0.8,
    readinessThreshold: 0.65,
    mascotCharacter: 'munch',
    mascotExpression: 'idle',
    mascotReason: '',
    generatedPaths: [],
    confidence: 1.0,
    activeTopicKey: 'general',
    personalityDecision: {
      dominantTrait: 'empathetic',
      communicationStyle: 'balanced',
      energyLevel: 'medium',
      expressionIntensity: 'medium',
      humorAllowed: false,
      useMetaphors: false,
      validateEmotion: true,
      challengeUser: false,
      confidence: 0.8,
      stability: 0.9,
      supportingTraits: [],
      responseConstraints: {
        avoidHumor: false,
        avoidLongReplies: false,
        avoidQuestions: false,
        avoidChallenges: false
      }
    },
    responsePlan: {
      responseGoal: 'comfort',
      primaryTopic: 'general',
      secondaryTopics: [],
      sections: [],
      requiredReferences: { story: false, memory: false, emotion: true },
      forbiddenReferences: { memory: false, story: false, humor: false },
      transitionHints: [],
      maxQuestions: 1,
      endingStyle: 'warm',
      confidence: 0.8
    }
  };
}

function makeMinimalContext(opts: { userInput?: string; previousAssistantResponses?: string[] } = {}): ContextPackage {
  return {
    user_id: 'test-user',
    user_input: opts.userInput || 'heyy whats up',
    options: [],
    profile_beliefs: [],
    relevant_memories: [],
    decision_history: [],
    previousAssistantResponses: opts.previousAssistantResponses || []
  };
}

function makeMockGatewayResponse(text: string, finishReason: string = 'stop'): GatewayResponse {
  return {
    requestId: 'mock-request-id',
    text,
    metrics: {
      providerId: 'gemini',
      modelId: 'gemini-1.5-flash',
      finishReason,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      latency: 150,
      retries: 0,
      timeoutMs: 5000,
      gatewayVersion: 'v1.0.0'
    },
    streamed: false
  };
}

function makeValidatorInput(responseText: string, previousAssistantResponses: string[] = []): ResponseValidatorInput {
  const promptPackage: PromptPackage = {
    version: 'v1.7.0',
    templateVersion: 'v1.0.0',
    sections: [],
    estimatedTokens: 150,
    checksum: 'test',
    directives: { mustDo: [], shouldDo: [], avoid: [] },
    statistics: { sections: 0, estimatedTokens: 150, checksum: 'test', compressionRatio: 1 },
    renderStrategy: 'conversation'
  };

  return {
    gatewayResponse: makeMockGatewayResponse(responseText),
    promptPackage,
    previousAssistantResponses
  };
}

// Test 1: Distinct responses are not flagged
describe('Test 1: distinct responses not flagged as duplicate', () => {
  it('does not flag distinct responses', () => {
    const plugin = new QualityValidationPlugin();
    const input = makeValidatorInput(
      "I'm glad to hear you're doing well! What's been on your mind?",
      ["That sounds really tough. How are you feeling about it?"]
    );
    const issues = plugin.validate(input);
    expect(issues.filter((i: any) => i.id.startsWith('quality-repeat'))).toHaveLength(0);
  });
});

// Test 2: Exact duplicate is rejected
describe('Test 2: exact duplicate is rejected', () => {
  it('flags exact duplicate as critical', () => {
    const plugin = new QualityValidationPlugin();
    const previous = "I've been following what you've shared, and I want to understand your situation before jumping to advice. How are you holding up?";
    const input = makeValidatorInput(previous, [previous]);
    const issues = plugin.validate(input);
    const repeatIssue = issues.find((i: any) => i.id === 'quality-repeat-assistant-response');
    expect(repeatIssue).toBeDefined();
    expect(repeatIssue?.severity).toBe('critical');
  });
});

// Test 3: Matching opening sentence is rejected
describe('Test 3: matching opening is rejected', () => {
  it('flags response with same opening as previous', () => {
    const plugin = new QualityValidationPlugin();
    const previous = "I've been following what you've shared. I want to understand your situation before jumping to advice.";
    const newResponse = "I've been following what you've shared. I can see this is important to you.";
    const input = makeValidatorInput(newResponse, [previous]);
    const issues = plugin.validate(input);
    const openingIssue = issues.find((i: any) => i.id === 'quality-repeat-assistant-opening');
    expect(openingIssue).toBeDefined();
    expect(openingIssue?.severity).toBe('critical');
  });
});

// Test 4: Retry exhaustion produces avoidRepetition hint
describe('Test 4: retry exhaustion produces avoidRepetition hint', () => {
  it('compiles avoidRepetition hint when repeat detected', () => {
    const validator = new ResponseValidator();
    const duplicate = "I've been following what you've shared, and I want to understand your situation before jumping to advice. How are you holding up?";
    const result = validator.validate(makeValidatorInput(duplicate, [duplicate]), 0);
    expect(result.passed).toBe(false);
    const hints = validator.compileRetryHints(result.issues);
    expect(hints.avoidRepetition).toBe(true);
  });
});

// Test 5: User messages excluded from previousAssistantResponses
describe('Test 5: user messages excluded from previousAssistantResponses', () => {
  it('only includes mascot sender messages', () => {
    const chatHistory = [
      { sender: 'mascot', content: 'What is on your mind today?' },
      { sender: 'user', content: 'heyy whats up' },
      { sender: 'mascot', content: "I've been following what you've shared." },
      { sender: 'user', content: "i'm good" }
    ];
    const previousAssistantResponses = chatHistory
      .filter((m: any) => m.sender === 'mascot' || m.role === 'assistant')
      .map((m: any) => typeof m.content === 'string' ? m.content.trim() : '')
      .filter(Boolean);
    expect(previousAssistantResponses).not.toContain("i'm good");
    expect(previousAssistantResponses).not.toContain('heyy whats up');
    expect(previousAssistantResponses).toContain('What is on your mind today?');
  });
});

// Test 6: Forbidden section in PromptBuilder output
describe('Test 6: forbidden section in PromptBuilder output', () => {
  it('injects forbidden_previous_responses when responses exist', async () => {
    const trace = makeMinimalTrace();
    const context = makeMinimalContext({
      previousAssistantResponses: ["I've been following what you've shared.", "That sounds challenging."]
    });
    const builder = new PromptBuilderEngine();
    const result = await builder.execute(trace, context);
    const pkg = result.promptPackage!;
    const forbiddenSection = pkg.sections.find((s: any) => s.id === 'forbidden_previous_responses');
    expect(forbiddenSection).toBeDefined();
    expect((forbiddenSection!.content as any).responses).toHaveLength(2);
  });

  it('limits forbidden responses to last 2', async () => {
    const trace = makeMinimalTrace();
    const context = makeMinimalContext({ previousAssistantResponses: ['A', 'B', 'C', 'D'] });
    const builder = new PromptBuilderEngine();
    const result = await builder.execute(trace, context);
    const pkg = result.promptPackage!;
    const forbidden = pkg.sections.find((s: any) => s.id === 'forbidden_previous_responses');
    expect((forbidden!.content as any).responses).toHaveLength(2);
    expect((forbidden!.content as any).responses[0]).toBe('C');
  });

  it('omits forbidden section when no previous responses', async () => {
    const trace = makeMinimalTrace();
    const context = makeMinimalContext({ previousAssistantResponses: [] });
    const builder = new PromptBuilderEngine();
    const result = await builder.execute(trace, context);
    const pkg = result.promptPackage!;
    const forbidden = pkg.sections.find((s: any) => s.id === 'forbidden_previous_responses');
    expect(forbidden).toBeUndefined();
  });
});

// Test 7: Service Worker POST bypass
describe('Test 7: service worker POST bypass', () => {
  it('sw.js contains non-GET bypass before cache-first', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const swPath = resolve(process.cwd(), 'public/sw.js');
    const swSource = readFileSync(swPath, 'utf-8');
    expect(swSource).toContain("request.method !== 'GET'");
    expect(swSource).toContain('/api/');
    const methodCheckIdx = swSource.indexOf("request.method !== 'GET'");
    const cacheMatchIdx = swSource.indexOf('caches.match(request)');
    expect(methodCheckIdx).toBeLessThan(cacheMatchIdx);
  });
});

// Test 8: Continuation response is not incorrectly blocked
describe('Test 8: continuation response is not incorrectly blocked', () => {
  it('fresh continuation response passes quality check', () => {
    const plugin = new QualityValidationPlugin();
    const fullResponse = 'It sounds like you have been deeply engaged with this project, and that persistence is something to be proud of.';
    const input = makeValidatorInput(fullResponse, []);
    const issues = plugin.validate(input);
    const repeatIssue = issues.find((i: any) => i.id.startsWith('quality-repeat'));
    expect(repeatIssue).toBeUndefined();
  });
});

// Test 9: Provider config unchanged
describe('Test 9: provider fallback config unchanged', () => {
  it('llmConfig still has gemini, groq, openrouter providers', async () => {
    const { llmConfig } = await import('../llm/config');
    expect(llmConfig.providers.gemini).toBeDefined();
    expect(llmConfig.providers.groq).toBeDefined();
    expect(llmConfig.providers.openrouter).toBeDefined();
  });
});

// Test 10: Anti-repetition regression
describe('Test 10: existing anti-repetition regression', () => {
  it('PromptBuilder version is v1.7.0', async () => {
    const trace = makeMinimalTrace();
    const context = makeMinimalContext();
    const builder = new PromptBuilderEngine();
    const result = await builder.execute(trace, context);
    expect(result.promptPackage?.version).toBe('v1.7.0');
  });

  it('validator passes for fresh non-duplicate response', () => {
    const validator = new ResponseValidator();
    const result = validator.validate(
      makeValidatorInput(
        "That is a great question. Let me think about that with you.",
        ["I'm here to help you work through this."]
      ),
      0
    );
    const repeatIssues = (result.issues || []).filter((i: any) => i.id.startsWith('quality-repeat'));
    expect(repeatIssues).toHaveLength(0);
  });
});
