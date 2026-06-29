import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class SafetyValidationPlugin implements ValidationPlugin {
  public id = 'safety-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text || '';

    // Rule 1: Leakage of internal pipeline architecture terms
    const forbiddenInternalTerms = [
      'readiness score',
      'readiness threshold',
      'reflection engine',
      'nlu engine',
      'cognitive trace',
      'prompt package',
      'context assembly',
      'personality decision',
      'response plan',
      'mascot decision'
    ];

    for (const term of forbiddenInternalTerms) {
      if (text.toLowerCase().includes(term)) {
        issues.push({
          id: 'safety-leakage-internal',
          category: 'safety',
          severity: 'critical',
          message: `Response contains raw internal cognitive engine reference: '${term}'`,
          recommendation: 'Strictly avoid disclosing system internals, engine names, or scores to users.'
        });
      }
    }

    return issues;
  }
}
