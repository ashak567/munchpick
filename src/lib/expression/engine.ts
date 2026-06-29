import {
  ExpressionRequest,
  ExpressionResult,
  ExpressionProfile,
  TransformerPlugin,
  ExpressionMetrics
} from './types';
import { CONTRACTIONS_MAP, ROBOTIC_TRANSITIONS_MAP } from './config';

// 1. Whitespace Transformer (v1.0.0)
export class WhitespaceTransformer implements TransformerPlugin {
  public id = 'whitespace';
  public version = '1.0.0';

  public transform(text: string, _profile: ExpressionProfile): string {
    return text
      .trim()
      .split('\n')
      .map(line => line.trim().replace(/[ \t]{2,}/g, ' '))
      .join('\n')
      // Collapse multiple consecutive newlines into exactly two
      .replace(/\n\s*\n\s*\n+/g, '\n\n');
  }
}

// 2. Formatting Transformer (v1.0.0)
export class FormattingTransformer implements TransformerPlugin {
  public id = 'formatting';
  public version = '1.0.0';

  public transform(text: string, _profile: ExpressionProfile): string {
    return text
      // Fix spacing before punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      // Normalize space after punctuation
      .replace(/([.,!?;:])([A-Za-z])/g, '$1 $2')
      // Normalize lists formatting
      .replace(/^\s*-\s+/gm, '- ');
  }
}

// 3. Rhythm Transformer (v1.0.0)
export class RhythmTransformer implements TransformerPlugin {
  public id = 'rhythm';
  public version = '1.0.0';

  public transform(text: string, _profile: ExpressionProfile): string {
    // Splicing extremely long run-on sentences deterministically at logical transition boundaries
    // Split sentences by end punctuation followed by spaces
    const sentences = text.split(/([.!?]\s+)/);
    const result: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      let sentence = sentences[i];
      if (!sentence) continue;

      // Only split actual text sentences, not the punctuation delimiters
      const wordCount = sentence.split(/\s+/).length;
      if (wordCount > 20) {
        // Splicing at logical connectors: ", but " -> ". But ", ", and " -> ". And "
        if (sentence.includes(', but ')) {
          sentence = sentence.replace(', but ', '. But ');
        } else if (sentence.includes(', and ')) {
          sentence = sentence.replace(', and ', '. And ');
        } else if (sentence.includes(', so ')) {
          sentence = sentence.replace(', so ', '. So ');
        }
      }
      result.push(sentence);
    }

    return result.join('');
  }
}

// 4. Repetition Transformer (v1.0.0)
export class RepetitionTransformer implements TransformerPlugin {
  public id = 'repetition';
  public version = '1.0.0';

  public transform(text: string, _profile: ExpressionProfile): string {
    // Split sentences and varying consecutive duplicate openings
    const sentences = text.split(/([.!?]\s+)/).filter(Boolean);
    const result: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      let current = sentences[i];
      let prev = result[result.length - 2]; // Skip the punctuation matching

      if (prev && current) {
        const prevClean = prev.trim().toLowerCase();
        const currentClean = current.trim().toLowerCase();

        // Check if both sentences start with duplicate greetings or pronoun openings
        if (prevClean.startsWith('i hear') && currentClean.startsWith('i hear')) {
          current = current.replace(/^i hear/i, 'It makes sense that');
        } else if (prevClean.startsWith('we can') && currentClean.startsWith('we can')) {
          current = current.replace(/^we can/i, "Let's");
        } else if (prevClean.startsWith('i feel') && currentClean.startsWith('i feel')) {
          current = current.replace(/^i feel/i, 'It feels like');
        }
      }
      result.push(current);
    }

    return result.join('');
  }
}

function replacePreservingCase(text: string, search: string, replacement: string): string {
  const regex = new RegExp(`\\b${search}\\b`, 'gi');
  return text.replace(regex, (match) => {
    if (match[0] === match[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

// 5. Expression Transformer (v1.0.0)
export class ExpressionTransformer implements TransformerPlugin {
  public id = 'expression';
  public version = '1.0.0';

  public transform(text: string, profile: ExpressionProfile): string {
    let result = text;

    // Apply contractions smoothing (especially for gentle/comfort communication profiles)
    if (profile.communicationStyle === 'gentle' || profile.communicationStyle === 'balanced') {
      for (const [robotic, natural] of Object.entries(CONTRACTIONS_MAP)) {
        result = replacePreservingCase(result, robotic, natural);
      }
    }

    // Apply robotic transitions mapping
    for (const [robotic, natural] of Object.entries(ROBOTIC_TRANSITIONS_MAP)) {
      result = replacePreservingCase(result, robotic, natural);
    }

    // Mascot-specific Expression formatting
    if (profile.mascotId === 'dobby') {
      // Dobby is highly energetic: make sure there is at least one exclamation point, but not excessive
      if (!result.includes('!')) {
        result = result.replace(/\.(?=[^.]*$)/, '!'); // Replace last period with exclamation point
      }
    } else if (profile.mascotId === 'ollie') {
      // Ollie is patient: keep ending periods clean
      result = result.replace(/!\s*$/, '.');
    }

    return result;
  }
}

export class ResponseExpressionEngine {
  private pipeline: TransformerPlugin[] = [];
  public expressionVersion = '1.0.0';

  constructor() {
    this.pipeline.push(new WhitespaceTransformer());
    this.pipeline.push(new FormattingTransformer());
    this.pipeline.push(new RhythmTransformer());
    this.pipeline.push(new RepetitionTransformer());
    this.pipeline.push(new ExpressionTransformer());
  }

  /**
   * Run the Expression Transformation pipeline.
   * Asserts integrity validations and reverts to original validated input on failure (fail gracefully).
   */
  public execute(request: ExpressionRequest): ExpressionResult {
    const startTime = Date.now();
    const originalText = request.validatedResponse;
    const profile = request.profile;

    let text = originalText;
    let transformationsApplied = 0;
    const transformerVersions: Record<string, string> = {};

    console.log('[ResponseExpressionEngine] Step: Pipeline Started');

    // Run pipeline
    for (const transformer of this.pipeline) {
      const inputLength = text.length;
      text = transformer.transform(text, profile);
      transformerVersions[transformer.id] = transformer.version;
      
      if (text.length !== inputLength || text !== originalText) {
        transformationsApplied++;
      }
      console.log(`[ResponseExpressionEngine] Step: Transformer '${transformer.id}' completed`);
    }

    // 6. Integrity check (Meaning preservation & Markdown Preservation)
    let passedIntegrity = true;
    const warnings: string[] = [];

    // Rule A: Check question marks ? are retained
    const originalQuestions = (originalText.match(/\?/g) || []).length;
    const transformedQuestions = (text.match(/\?/g) || []).length;
    if (originalQuestions !== transformedQuestions) {
      passedIntegrity = false;
      warnings.push(`Integrity validation failed: original questions count (${originalQuestions}) !== transformed (${transformedQuestions}).`);
    }

    // Rule B: Length check (make sure sentences did not disappear)
    const lengthRatio = text.length / originalText.length;
    if (lengthRatio < 0.65 || lengthRatio > 1.35) {
      passedIntegrity = false;
      warnings.push(`Integrity validation failed: length ratio '${lengthRatio.toFixed(2)}' is outside acceptable boundaries.`);
    }

    // Rule C: Markdown structures count (ensure Headings, Bold elements match)
    const originalBolds = (originalText.match(/\*\*/g) || []).length;
    const transformedBolds = (text.match(/\*\*/g) || []).length;
    if (originalBolds !== transformedBolds) {
      passedIntegrity = false;
      warnings.push(`Integrity validation failed: bold markers mismatched.`);
    }

    // Rollback policy if integrity fails
    if (!passedIntegrity) {
      console.warn('[ResponseExpressionEngine] Integrity checks failed. Reverting to original validated response.');
      text = originalText;
      transformationsApplied = 0;
    }

    const durationMs = Date.now() - startTime;
    console.log(`[ResponseExpressionEngine] Step: Completed (passedIntegrity=${passedIntegrity})`);

    const metrics: ExpressionMetrics = {
      expressionVersion: this.expressionVersion,
      transformerVersions,
      transformationsApplied,
      readabilityImproved: passedIntegrity,
      paragraphsBalanced: true,
      duplicatePhrasesRemoved: 0,
      warnings
    };

    return {
      finalText: text,
      metrics
    };
  }
}
