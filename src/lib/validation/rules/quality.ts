import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class QualityValidationPlugin implements ValidationPlugin {
  public id = 'quality-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text?.trim() || '';

    if (!text) return issues;

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
