import { describe, it, expect } from 'vitest';
import { safeJoinContinuation, buildContinuationPromptPackage } from './continuation';
import { PromptPackage } from '../reflection/types';
import * as crypto from 'crypto';

function createMockPromptPackage(userInput = 'I am overwhelmed'): PromptPackage {
  const sections = [
    { id: 'system_instructions', type: 'system' as const, priority: 1.0, required: true, content: 'System rules' },
    { id: 'mascot_identity', type: 'identity' as const, priority: 0.9, required: true, content: { mascotId: 'munch' } },
    { id: 'personality_guidelines', type: 'personality' as const, priority: 0.8, required: true, content: 'Warm and calm' },
    { id: 'conversation_history', type: 'conversation' as const, priority: 0.7, required: true, content: `User: "${userInput}"` },
    { id: 'response_plan_meta', type: 'response_plan' as const, priority: 0.6, required: true, content: 'Goal: comfort' },
    { id: 'output_instructions', type: 'instructions' as const, priority: 0.5, required: true, content: 'Generate response' }
  ];

  const rawString = sections
    .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
    .join('|');
  const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

  return {
    version: 'v1.5.0',
    templateVersion: 'v1.0.0',
    renderStrategy: 'comfort',
    directives: {
      mustDo: ['Validate user feelings'],
      shouldDo: ['Keep tone gentle'],
      avoid: ['No harsh words']
    },
    sections,
    estimatedTokens: 50,
    statistics: { sections: sections.length, estimatedTokens: 50, checksum, compressionRatio: 1.0 },
    checksum,
    isIncomplete: false,
    providerHints: {
      supportsStreaming: true,
      supportsVision: false,
      supportsReasoning: true
    }
  };
}

describe('Continuation Architecture - Boundary Deduplication & Joining', () => {
  it('should naturally stitch partial text and continuation with proper space', () => {
    const partial = 'I can see why this feels overwhelming, and maybe the first thing we can';
    const continuation = 'is make things smaller. We can start with one small step.';
    const result = safeJoinContinuation(partial, continuation);

    expect(result).toBe('I can see why this feels overwhelming, and maybe the first thing we can is make things smaller. We can start with one small step.');
  });

  it('should deduplicate overlapping prefix in continuation', () => {
    const partial = 'I can see why this feels overwhelming, and maybe the first thing we can';
    const continuation = 'we can do is take a deep breath together. Everything is going to be okay.';
    const result = safeJoinContinuation(partial, continuation);

    expect(result).toBe('I can see why this feels overwhelming, and maybe the first thing we can do is take a deep breath together. Everything is going to be okay.');
  });

  it('should deduplicate multi-word overlapping phrases cleanly', () => {
    const partial = 'It sounds like you have been working very hard on this project and';
    const continuation = 'hard on this project and you deserve some restful time to unwind.';
    const result = safeJoinContinuation(partial, continuation);

    expect(result).toBe('It sounds like you have been working very hard on this project and you deserve some restful time to unwind.');
  });

  it('should attach punctuation and contractions without extra space', () => {
    const partial = "I know it feels like you can";
    const continuation = "'t do this alone, but I'm right here with you.";
    const result = safeJoinContinuation(partial, continuation);

    expect(result).toBe("I know it feels like you can't do this alone, but I'm right here with you.");
  });

  it('should attach comma or period without extra space', () => {
    const partial = 'Take a deep breath';
    const continuation = ', and let us take this one step at a time.';
    const result = safeJoinContinuation(partial, continuation);

    expect(result).toBe('Take a deep breath, and let us take this one step at a time.');
  });
});

describe('Continuation Prompt Package Construction', () => {
  it('should build a valid continuation PromptPackage with partial response section and disabled reasoning hints', () => {
    const originalPkg = createMockPromptPackage('My exams are tomorrow and I am scared');
    const partial = "Oh, sweet friend, it's completely understandable to feel scared before";

    const contPkg = buildContinuationPromptPackage(originalPkg, partial);

    // Verify package integrity
    expect(contPkg.isIncomplete).toBe(false);
    expect(contPkg.checksum).toBeDefined();
    expect(contPkg.providerHints?.supportsReasoning).toBe(false);

    // Verify partial response section is present
    const partialSec = contPkg.sections.find(s => s.id === 'partial_assistant_response');
    expect(partialSec).toBeDefined();
    expect(partialSec?.content).toContain(partial);

    // Verify continuation instructions
    const instSec = contPkg.sections.find(s => s.id === 'continuation_instructions');
    expect(instSec).toBeDefined();
    expect(instSec?.content).toContain('CONTINUE the response seamlessly');
  });
});
