import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class ConsistencyValidationPlugin implements ValidationPlugin {
  public id = 'consistency-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text || '';
    const mascot = input.mascotDecision;
    const plan = input.responsePlan;

    // Rule 1: Mascot name/character mismatch checks
    if (mascot && mascot.mascotId) {
      const activeMascot = mascot.mascotId.toLowerCase();
      const allMascots = ['munch', 'pandy', 'froggy', 'dobby', 'chicky', 'ollie', 'ellie'];
      const otherMascots = allMascots.filter(m => m !== activeMascot);

      for (const other of otherMascots) {
        // Simple word boundaries match
        const regex = new RegExp(`\\b${other}\\b`, 'i');
        if (regex.test(text)) {
          issues.push({
            id: 'consistency-mascot-contradiction',
            category: 'consistency',
            severity: 'critical',
            message: `Response contains reference to mascot '${other}' but active mascot is '${activeMascot}'.`,
            recommendation: 'Re-run or rewrite without reference to other mascot personalities.'
          });
        }
      }
    }

    // Rule 2: Forbidden references in plan
    if (plan && plan.forbiddenReferences) {
      if (plan.forbiddenReferences.memory && text.toLowerCase().includes('memory')) {
        issues.push({
          id: 'consistency-forbidden-memory',
          category: 'consistency',
          severity: 'high',
          message: 'Response references memory context which is forbidden by the current response plan.',
          recommendation: 'Remove memories and past mentions from the output.',
          retryHint: { shorten: true }
        });
      }
      if (plan.forbiddenReferences.story && text.toLowerCase().includes('story')) {
        issues.push({
          id: 'consistency-forbidden-story',
          category: 'consistency',
          severity: 'high',
          message: 'Response references story context which is forbidden by the current response plan.',
          recommendation: 'Focus strictly on the current dialogue and avoid narrative tracking references.',
          retryHint: { shorten: true }
        });
      }
    }

    return issues;
  }
}
