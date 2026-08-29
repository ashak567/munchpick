import * as crypto from 'crypto';
import { PromptPackage, PromptSection } from '../reflection/types';
import { estimateTokens } from '../reflection/context-assembly';

/**
 * Normalizes a word for boundary overlap comparison.
 */
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Safely joins a partial truncated response with a continuation response.
 * Handles:
 * - Overlap deduplication (if continuation repeated trailing words of partial)
 * - Boundary whitespace (missing or double spaces)
 * - Boundary punctuation and contractions
 * - Sentence completeness
 */
export function safeJoinContinuation(partial: string, continuation: string): string {
  const cleanPartial = (partial || '').trimEnd();
  let cleanContinuation = (continuation || '').trimStart();

  if (!cleanPartial) return cleanContinuation.trim();
  if (!cleanContinuation) return cleanPartial.trim();

  // 1. Boundary Overlap Deduplication
  // Check if continuation starts with words that match the tail of partial
  const partialWords = cleanPartial.split(/\s+/).filter(Boolean);
  const continuationWords = cleanContinuation.split(/\s+/).filter(Boolean);

  let overlapCount = 0;
  const maxCheck = Math.min(10, partialWords.length, continuationWords.length);

  for (let len = maxCheck; len >= 1; len--) {
    const partialTail = partialWords.slice(-len).map(normalizeWord).join(' ');
    const continuationHead = continuationWords.slice(0, len).map(normalizeWord).join(' ');

    if (partialTail && continuationHead && partialTail === continuationHead) {
      overlapCount = len;
      break;
    }
  }

  if (overlapCount > 0) {
    // Strip the overlapping words from continuation
    const remainingContinuationWords = continuationWords.slice(overlapCount);
    cleanContinuation = remainingContinuationWords.join(' ');
  }

  if (!cleanContinuation) {
    return cleanPartial.trim();
  }

  // 2. Whitespace and Punctuation Boundary Stitching
  const lastCharPartial = cleanPartial[cleanPartial.length - 1];
  const firstCharContinuation = cleanContinuation[0];

  let joined: string;

  // If continuation starts with attached punctuation like ',' '.' '!' '?' ';' ':' or contraction "'s" "'t" "'ve" "'re"
  const isPunctuationOrContraction = /^[,\.!?;:\'\")]/.test(cleanContinuation);
  
  if (isPunctuationOrContraction) {
    joined = `${cleanPartial}${cleanContinuation}`;
  } else if (/\s$/.test(cleanPartial)) {
    joined = `${cleanPartial}${cleanContinuation}`;
  } else {
    joined = `${cleanPartial} ${cleanContinuation}`;
  }

  // Clean up any accidental double spaces (preserving newlines)
  joined = joined.replace(/[ \t]{2,}/g, ' ').trim();

  return joined;
}

/**
 * Builds a deterministic continuation PromptPackage from an original PromptPackage and partial text.
 */
export function buildContinuationPromptPackage(
  originalPkg: PromptPackage,
  partialResponse: string
): PromptPackage {
  const cleanPartial = (partialResponse || '').trim();

  // Filter existing sections, updating instructions to focus strictly on seamless continuation
  const sections: PromptSection[] = [];

  for (const section of originalPkg.sections) {
    if (section.type === 'instructions') {
      sections.push({
        id: 'continuation_instructions',
        type: 'instructions',
        priority: 0.95,
        required: true,
        content: `IMPORTANT CONTINUATION INSTRUCTIONS:
The previous assistant response generation was interrupted mid-sentence at the token limit.
Your task is to CONTINUE the response seamlessly from the exact stopping point.

CRITICAL RULES:
1. DO NOT restart the response or start with a new greeting.
2. DO NOT repeat, rephrase, or summarize the partial response.
3. DO NOT mention that an interruption, continuation, or token limit occurred.
4. Continue the active mascot speaking tone, empathy, and personality.
5. Complete the current sentence naturally, provide the remaining guidance/closing smoothly, and end with terminal punctuation (. ! ?).`
      });
    } else {
      sections.push({ ...section });
    }
  }

  // Inject partial response section
  sections.push({
    id: 'partial_assistant_response',
    type: 'conversation',
    priority: 0.90,
    required: true,
    content: `PARTIAL ASSISTANT RESPONSE (CONTINUE DIRECTLY FROM THE EXACT END OF THIS TEXT):\n"${cleanPartial}"`
  });

  // Sort sections by priority descending
  sections.sort((a, b) => b.priority - a.priority);

  // Recalculate checksum
  const rawString = sections
    .map(s => `${s.id}:${s.type}:${s.priority}:${typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}`)
    .join('|');
  const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

  const estimatedTokens = estimateTokens(rawString);

  return {
    version: originalPkg.version,
    templateVersion: originalPkg.templateVersion,
    renderStrategy: originalPkg.renderStrategy,
    directives: {
      mustDo: [
        'Continue generating seamlessly from the end of the partial assistant response.',
        'Finish the ongoing sentence naturally.',
        ...(originalPkg.directives?.mustDo || [])
      ],
      shouldDo: [
        'End with complete terminal punctuation (. ! ?).',
        ...(originalPkg.directives?.shouldDo || [])
      ],
      avoid: [
        'Do not restart or repeat the beginning of the response.',
        'Do not mention any interruption or token limit.',
        ...(originalPkg.directives?.avoid || [])
      ]
    },
    sections,
    estimatedTokens,
    statistics: {
      sections: sections.length,
      estimatedTokens,
      checksum,
      compressionRatio: 1.0
    },
    checksum,
    isIncomplete: false,
    providerHints: {
      supportsStreaming: originalPkg.providerHints?.supportsStreaming ?? true,
      supportsVision: originalPkg.providerHints?.supportsVision ?? false,
      supportsReasoning: false // Disable reasoning tokens during continuation for fast, deterministic completion
    }
  };
}
