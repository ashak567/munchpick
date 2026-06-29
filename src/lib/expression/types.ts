import { PersonalityDecision, MascotDecision, ResponsePlan } from '../reflection/types';

export interface ExpressionProfile {
  mascotId: string;
  dominantTrait: string;
  communicationStyle: 'gentle' | 'balanced' | 'direct';
  energyLevel: 'low' | 'medium' | 'high';
  expressionIntensity: 'low' | 'medium' | 'high';
  humorAllowed: boolean;
  useMetaphors: boolean;
}

export interface ExpressionRequest {
  validatedResponse: string;
  profile: ExpressionProfile;
  responsePlan?: ResponsePlan;
}

export interface TransformerPlugin {
  id: string;
  version: string;
  transform(text: string, profile: ExpressionProfile): string;
}

export interface ExpressionMetrics {
  expressionVersion: string;
  transformerVersions: Record<string, string>;
  transformationsApplied: number;
  readabilityImproved: boolean;
  paragraphsBalanced: boolean;
  duplicatePhrasesRemoved: number;
  warnings: string[];
}

export interface ExpressionResult {
  finalText: string;
  expressionMetadata?: Record<string, unknown>;
  metrics: ExpressionMetrics;
}
