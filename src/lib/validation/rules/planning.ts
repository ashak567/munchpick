import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class PlanningValidationPlugin implements ValidationPlugin {
  public id = 'planning-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text || '';
    const plan = input.responsePlan;

    if (!plan) return issues;

    // Rule 1: Question limits
    const maxQs = plan.maxQuestions ?? 1;
    const questionMarks = (text.match(/\?/g) || []).length;

    if (questionMarks > maxQs) {
      issues.push({
        id: 'plan-question-limit',
        category: 'planning',
        severity: 'high',
        message: `Response contains ${questionMarks} questions, exceeding plan limit of ${maxQs}.`,
        recommendation: 'Reduce the number of questions to match the planned maximum questions.',
        retryHint: { reduceQuestions: true }
      });
    }

    return issues;
  }
}
