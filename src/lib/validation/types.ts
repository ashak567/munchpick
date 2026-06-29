import { PromptPackage, ResponsePlan, PersonalityDecision, MascotDecision, ContextAssembly } from '../reflection/types';
import { GatewayResponse } from '../llm/types';

export type ValidationSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ValidationCategory = 'structure' | 'planning' | 'consistency' | 'formatting' | 'style' | 'safety' | 'quality';

export interface RetryHints {
  shorten: boolean;
  removeHumor: boolean;
  reduceQuestions: boolean;
  strengthenEmpathy: boolean;
  improveFormatting: boolean;
}

export interface ValidationIssue {
  id: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  message: string;
  recommendation: string;
  retryHint?: Partial<RetryHints>;
}

export interface ResponseValidatorInput {
  gatewayResponse: GatewayResponse;
  promptPackage: PromptPackage;
  responsePlan?: ResponsePlan;
  personalityDecision?: PersonalityDecision;
  mascotDecision?: MascotDecision;
  contextAssembly?: ContextAssembly;
}

export interface ValidationPlugin {
  id: string;
  validate(input: ResponseValidatorInput): ValidationIssue[];
}

export interface ResponseValidation {
  passed: boolean;
  validationScore: number;
  highestSeverity?: ValidationSeverity;
  issues: ValidationIssue[];
  warnings: string[];
  metrics: {
    durationMs: number;
    rulesExecuted: number;
    rulesFailed: number;
    retryCount: number;
    validatorVersion: string;
    rulesVersion: string;
    responseHash: string;
  };
}
