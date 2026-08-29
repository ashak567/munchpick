import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : text.trim();
}

export class QualityValidationPlugin implements ValidationPlugin {
  public id = 'quality-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text?.trim() || '';

    if (!text) return issues;

    // Rule 0: Cross-turn repetition. The model is allowed to use history for
    // continuity, but it must not resend a prior mascot response or opening.
    const normalizedText = normalizeForComparison(text);
    const normalizedOpening = normalizeForComparison(firstSentence(text));
    for (const previous of input.previousAssistantResponses || []) {
      if (!previous || !previous.trim()) continue;

      const normalizedPrevious = normalizeForComparison(previous);
      if (normalizedText && normalizedText === normalizedPrevious) {
        issues.push({
          id: 'quality-repeat-assistant-response',
          category: 'quality',
          severity: 'critical',
          message: 'Response duplicates a previous assistant message from this conversation.',
          recommendation: 'Regenerate a substantively new response that addresses the current user message.',
          retryHint: { avoidRepetition: true }
        });
        break;
      }

      const previousOpening = normalizeForComparison(firstSentence(previous));
      if (normalizedOpening.length >= 24 && normalizedOpening === previousOpening) {
        issues.push({
          id: 'quality-repeat-assistant-opening',
          category: 'quality',
          severity: 'critical',
          message: 'Response reuses the opening sentence of a previous assistant message.',
          recommendation: 'Regenerate with a new opening that directly addresses the current user message.',
          retryHint: { avoidRepetition: true }
        });
        break;
      }
    }

    // Rule 1: Duplicate paragraphs
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const seen = new Set<string>();

    for (const p of paragraphs) {
      // Normalize whitespace and lowercase to compare
      const normalized = p.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(normalized)) {
        issues.push({
          id: 'quality-duplicate-paragraph',
          category: 'quality',
          severity: 'high',
          message: 'Response contains identical or near-identical duplicated paragraphs.',
          recommendation: 'Remove duplicate paragraphs or loops from dialogue.',
          retryHint: { improveFormatting: true }
        });
        break;
      }
      seen.add(normalized);
    }

    // Rule 2: Excessive verbosity / length (quality check)
    // E.g., if response is plan says max questions but output is extremely long (like > 600 characters)
    if (text.length > 800) {
      issues.push({
        id: 'quality-excessive-length',
        category: 'quality',
        severity: 'medium',
        message: `Response is excessively long (${text.length} chars). Target is brief mascot communication.`,
        recommendation: 'Keep descriptions concise and sentence structures direct.',
        retryHint: { shorten: true }
      });
    }

    return issues;
  }
}
