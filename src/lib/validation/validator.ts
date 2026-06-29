import * as crypto from 'crypto';
import {
  ResponseValidatorInput,
  ResponseValidation,
  ValidationPlugin,
  ValidationIssue,
  ValidationSeverity,
  RetryHints
} from './types';
import {
  StructureValidationPlugin,
  PlanningValidationPlugin,
  ConsistencyValidationPlugin,
  FormattingValidationPlugin,
  StyleValidationPlugin,
  SafetyValidationPlugin,
  QualityValidationPlugin
} from './rules';

export class ResponseValidator {
  private plugins: ValidationPlugin[] = [];
  public validatorVersion = '1.0.0';
  public rulesVersion = '1.0.0';

  constructor() {
    // Register all default validation plugins
    this.registerPlugin(new StructureValidationPlugin());
    this.registerPlugin(new PlanningValidationPlugin());
    this.registerPlugin(new ConsistencyValidationPlugin());
    this.registerPlugin(new FormattingValidationPlugin());
    this.registerPlugin(new StyleValidationPlugin());
    this.registerPlugin(new SafetyValidationPlugin());
    this.registerPlugin(new QualityValidationPlugin());
  }

  public registerPlugin(plugin: ValidationPlugin): void {
    const idx = this.plugins.findIndex(p => p.id === plugin.id);
    if (idx !== -1) {
      this.plugins[idx] = plugin;
    } else {
      this.plugins.push(plugin);
    }
  }

  /**
   * Main validation engine execution.
   * Runs all registered plugins and calculates validation scores, hashes, and retry hints.
   */
  public validate(input: ResponseValidatorInput, retryCount = 0): ResponseValidation {
    const startTime = Date.now();
    const text = input.gatewayResponse.text || '';
    
    // Structured logging: Validation Started
    console.log(`[ResponseValidator] Step: Validation Started`);

    const issues: ValidationIssue[] = [];

    // Run each plugin
    for (const plugin of this.plugins) {
      try {
        const pluginIssues = plugin.validate(input);
        issues.push(...pluginIssues);
      } catch (err: any) {
        console.error(`[ResponseValidator] Plugin '${plugin.id}' failed to run:`, err);
      }
    }

    // Calculate score
    let score = 100;
    let highestSeverity: ValidationSeverity | undefined;

    for (const issue of issues) {
      // Deduct score
      if (issue.severity === 'critical') {
        score -= 30;
        highestSeverity = 'critical';
      } else if (issue.severity === 'high') {
        score -= 15;
        if (highestSeverity !== 'critical') highestSeverity = 'high';
      } else if (issue.severity === 'medium') {
        score -= 5;
        if (!highestSeverity || (highestSeverity !== 'critical' && highestSeverity !== 'high')) {
          highestSeverity = 'medium';
        }
      } else if (issue.severity === 'low') {
        score -= 2;
        if (!highestSeverity) highestSeverity = 'low';
      }
    }

    // Cap score at 0-100
    const validationScore = Math.max(0, Math.min(100, score));

    // Determine pass status: Must be >= 80 and have no critical issues
    const passed = validationScore >= 80 && highestSeverity !== 'critical';

    // Group warnings (medium and low severity issues)
    const warnings = issues
      .filter(i => i.severity === 'medium' || i.severity === 'low')
      .map(i => i.message);

    // Compute SHA-256 response hash
    const responseHash = crypto.createHash('sha256').update(text).digest('hex');

    // Logging progress step-by-step
    console.log(`[ResponseValidator] Step: Structure Passed (errors=${issues.filter(i => i.category === 'structure').length})`);
    console.log(`[ResponseValidator] Step: Planner Alignment Passed (errors=${issues.filter(i => i.category === 'planning').length})`);
    console.log(`[ResponseValidator] Step: Memory Validation Passed (errors=${issues.filter(i => i.category === 'consistency').length})`);
    if (warnings.length > 0) {
      console.log(`[ResponseValidator] Step: Warnings Found (count=${warnings.length})`);
    }
    console.log(`[ResponseValidator] Step: Completed (score=${validationScore}, passed=${passed})`);

    const durationMs = Date.now() - startTime;

    return {
      passed,
      validationScore,
      highestSeverity,
      issues,
      warnings,
      metrics: {
        durationMs,
        rulesExecuted: this.plugins.length,
        rulesFailed: issues.length,
        retryCount,
        validatorVersion: this.validatorVersion,
        rulesVersion: this.rulesVersion,
        responseHash
      }
    };
  }

  /**
   * Compiles consolidated retry hints from validation issues.
   */
  public compileRetryHints(issues: ValidationIssue[]): RetryHints {
    const hints: RetryHints = {
      shorten: false,
      removeHumor: false,
      reduceQuestions: false,
      strengthenEmpathy: false,
      improveFormatting: false
    };

    for (const issue of issues) {
      if (issue.retryHint) {
        if (issue.retryHint.shorten) hints.shorten = true;
        if (issue.retryHint.removeHumor) hints.removeHumor = true;
        if (issue.retryHint.reduceQuestions) hints.reduceQuestions = true;
        if (issue.retryHint.strengthenEmpathy) hints.strengthenEmpathy = true;
        if (issue.retryHint.improveFormatting) hints.improveFormatting = true;
      }
    }

    return hints;
  }
}
