import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class StructureValidationPlugin implements ValidationPlugin {
  public id = 'structure-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text?.trim() || '';

    // Rule 1: Empty response check
    if (!text) {
      issues.push({
        id: 'struct-empty',
        category: 'structure',
        severity: 'critical',
        message: 'The generated LLM response is empty or contains only whitespace.',
        recommendation: 'Re-run generation with default provider or check connection.'
      });
      return issues;
    }

    // Rule 2: Unfinished / truncated ending check
    // If it doesn't end with typical punctuation (. ! ? " ' ) ) or codeblock markers
    const lastChar = text[text.length - 1];
    const allowedEndings = ['.', '!', '?', '"', "'", ')', '*', '`'];
    
    if (!allowedEndings.includes(lastChar)) {
      issues.push({
        id: 'struct-truncated',
        category: 'structure',
        severity: 'high',
        message: `The response ending seems truncated or cut-off. Ending character: '${lastChar}'`,
        recommendation: 'Ensure formatting closes properly and sentences are complete.',
        retryHint: { improveFormatting: true }
      });
    }

    return issues;
  }
}
