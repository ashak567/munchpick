import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class FormattingValidationPlugin implements ValidationPlugin {
  public id = 'formatting-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text || '';

    // Rule 1: Mismatched asterisks
    const asteriskCount = (text.match(/\*/g) || []).length;
    if (asteriskCount % 2 !== 0) {
      issues.push({
        id: 'format-mismatched-asterisk',
        category: 'formatting',
        severity: 'high',
        message: `Response contains an odd number of asterisks (${asteriskCount}), suggesting unclosed markdown formatting.`,
        recommendation: 'Verify and close all markdown formatting asterisks.',
        retryHint: { improveFormatting: true }
      });
    }

    // Rule 2: Mismatched brackets
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push({
        id: 'format-mismatched-brackets',
        category: 'formatting',
        severity: 'medium',
        message: `Mismatched brackets: open='${openBrackets}', close='${closeBrackets}'.`,
        recommendation: 'Check that all square brackets are closed.'
      });
    }

    return issues;
  }
}
