import { describe, it, expect } from 'vitest';
import { ResponseExpressionEngine } from './engine';
import { ExpressionProfile } from './types';
import { PIPELINE_VERSION } from '../reflection/speculative';

function getMockProfile(mascotId = 'pandy', commStyle: 'gentle' | 'balanced' | 'direct' = 'gentle'): ExpressionProfile {
  return {
    mascotId,
    dominantTrait: 'empathetic',
    communicationStyle: commStyle,
    energyLevel: 'medium',
    expressionIntensity: 'medium',
    humorAllowed: false,
    useMetaphors: true
  };
}

describe('Response Expression Engine Tests', () => {
  const engine = new ResponseExpressionEngine();

  it('should collapse excessive whitespace and double spaces', () => {
    const text = "Hello  friend.   \n\n\nHow  are  you?";
    const profile = getMockProfile();
    const result = engine.execute({ validatedResponse: text, profile });

    expect(result.finalText).toBe("Hello friend.\n\nHow are you?");
    expect(result.metrics.transformationsApplied).toBeGreaterThan(0);
  });

  it('should fix spacing before/after punctuation marks', () => {
    const text = "Yes , I think so . Really ?";
    const profile = getMockProfile();
    const result = engine.execute({ validatedResponse: text, profile });

    expect(result.finalText).toBe("Yes, I think so. Really?");
  });

  it('should preserve important markdown structures (headings, lists, bold)', () => {
    const text = "### Hello\n\n- **Item 1**\n- Item 2";
    const profile = getMockProfile();
    const result = engine.execute({ validatedResponse: text, profile });

    expect(result.finalText).toContain("### Hello");
    expect(result.finalText).toContain("- **Item 1**");
    expect(result.finalText).toContain("- Item 2");
    expect(result.metrics.readabilityImproved).toBe(true);
  });

  it('should reduce repetitive sentence openings', () => {
    const text = "I hear you feel tired. I hear you want to rest.";
    const profile = getMockProfile();
    const result = engine.execute({ validatedResponse: text, profile });

    expect(result.finalText).toBe("I hear you feel tired. It makes sense that you want to rest.");
  });

  it('should splice extremely long sentences at logical boundaries', () => {
    const text = "I understand that you have been working very hard to get this project ready for launch, but you really need to take a break.";
    const profile = getMockProfile();
    const result = engine.execute({ validatedResponse: text, profile });

    expect(result.finalText).toBe("I understand that you have been working very hard to get this project ready for launch. But you really need to take a break.");
  });

  it('should apply contractions and robotic transitions smoothing in gentle style', () => {
    const text = "I am ready to help. Furthermore, I cannot allow you to skip rest.";
    const profile = getMockProfile('pandy', 'gentle');
    const result = engine.execute({ validatedResponse: text, profile });

    expect(result.finalText).toBe("I'm ready to help. Also, I can't allow you to skip rest.");
  });

  it('should adjust exclamations and ending punctuation for different mascots', () => {
    // Dobby uses exclamation points
    const textDobby = "I am ready to run.";
    const profileDobby = getMockProfile('dobby', 'balanced');
    const resultDobby = engine.execute({ validatedResponse: textDobby, profile: profileDobby });
    expect(resultDobby.finalText).toBe("I'm ready to run!");

    // Ollie uses periods
    const textOllie = "I am ready to run!";
    const profileOllie = getMockProfile('ollie', 'balanced');
    const resultOllie = engine.execute({ validatedResponse: textOllie, profile: profileOllie });
    expect(resultOllie.finalText).toBe("I'm ready to run.");
  });

  it('should fail integrity verification and rollback if questions are stripped', () => {
    const text = "Are you okay? I am here to help.";
    // Mock a broken transformer that strips questions
    const brokenEngine = new ResponseExpressionEngine();
    (brokenEngine as any).pipeline = [{
      id: 'broken-transformer',
      version: '1.0.0',
      transform: () => "I am here to help." // strips the question
    }];

    const result = brokenEngine.execute({ validatedResponse: text, profile: getMockProfile() });
    
    // Output should rollback to original validated text
    expect(result.finalText).toBe(text);
    expect(result.metrics.readabilityImproved).toBe(false);
    expect(result.metrics.warnings[0]).toContain("questions count");
  });

  it('should produce deterministic outputs for identical inputs', () => {
    const text = "Hello  friend! I am   ready.";
    const profile = getMockProfile();

    const result1 = engine.execute({ validatedResponse: text, profile });
    const result2 = engine.execute({ validatedResponse: text, profile });

    expect(result1.finalText).toBe(result2.finalText);
  });

  it('should play nicely with pipeline version', () => {
    expect(PIPELINE_VERSION).toBe('v1.8.0');
  });
});
