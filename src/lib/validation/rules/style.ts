import { ValidationPlugin, ResponseValidatorInput, ValidationIssue } from '../types';

export class StyleValidationPlugin implements ValidationPlugin {
  public id = 'style-validation';

  public validate(input: ResponseValidatorInput): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const text = input.gatewayResponse.text || '';
    const personality = input.personalityDecision;

    if (!personality) return issues;

    // Rule 1: Humor constraints
    if (personality.humorAllowed === false) {
      const humorWords = ['haha', 'lol', 'funny', 'joke', 'laugh', 'lmao'];
      for (const word of humorWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(text)) {
          issues.push({
            id: 'style-humor-disallowed',
            category: 'style',
            severity: 'medium',
            message: `Response contains humor indicator '${word}' which is prohibited by personality constraints.`,
            recommendation: 'Remove humor markers and keep the reply serious or comforting.',
            retryHint: { removeHumor: true }
          });
          break;
        }
      }
    }

    // Rule 2: Metaphor restrictions
    if (personality.useMetaphors === false) {
      const metaphorMarkers = ['is like a', 'just like a', 'resembles a'];
      for (const marker of metaphorMarkers) {
        if (text.toLowerCase().includes(marker)) {
          issues.push({
            id: 'style-metaphor-disallowed',
            category: 'style',
            severity: 'medium',
            message: `Response contains metaphor marker '${marker}' which is prohibited.`,
            recommendation: 'Express the concept directly without metaphors.',
            retryHint: { removeHumor: false }
          });
          break;
        }
      }
    }

    return issues;
  }
}
