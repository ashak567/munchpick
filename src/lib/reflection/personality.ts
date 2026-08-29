import { CognitiveEngine, CognitiveTrace, ContextPackage, PersonalityProfile, PersonalityDecision, ResponseConstraints, MascotCharacter } from './types';

// Core baseline personality profiles per mascot
const MASCOT_CORE_PROFILES: Record<string, PersonalityProfile> = {
  munch: {
    empathy: 0.8,
    curiosity: 0.7,
    playfulness: 0.5,
    encouragement: 0.7,
    calmness: 0.8,
    directness: 0.4,
    optimism: 0.6,
    confidence: 0.6
  },
  ollie: {
    empathy: 0.6,
    curiosity: 0.95,
    playfulness: 0.3,
    encouragement: 0.6,
    calmness: 0.8,
    directness: 0.5,
    optimism: 0.6,
    confidence: 0.85
  },
  ellie: {
    empathy: 0.95,
    curiosity: 0.5,
    playfulness: 0.3,
    encouragement: 0.8,
    calmness: 0.9,
    directness: 0.3,
    optimism: 0.6,
    confidence: 0.8
  },
  pandy: {
    empathy: 0.95,
    curiosity: 0.4,
    playfulness: 0.3,
    encouragement: 0.6,
    calmness: 0.95,
    directness: 0.2,
    optimism: 0.5,
    confidence: 0.7
  },
  dobby: {
    empathy: 0.6,
    curiosity: 0.6,
    playfulness: 0.8,
    encouragement: 0.95,
    calmness: 0.4,
    directness: 0.7,
    optimism: 0.95,
    confidence: 0.9
  },
  coco: {
    empathy: 0.7,
    curiosity: 0.9,
    playfulness: 0.85,
    encouragement: 0.7,
    calmness: 0.6,
    directness: 0.4,
    optimism: 0.8,
    confidence: 0.75
  },
  froggy: {
    empathy: 0.7,
    curiosity: 0.5,
    playfulness: 0.3,
    encouragement: 0.6,
    calmness: 0.98,
    directness: 0.4,
    optimism: 0.6,
    confidence: 0.8
  },
  bubbles: {
    empathy: 0.75,
    curiosity: 0.7,
    playfulness: 0.7,
    encouragement: 0.7,
    calmness: 0.9,
    directness: 0.3,
    optimism: 0.8,
    confidence: 0.75
  },
  chicky: {
    empathy: 0.7,
    curiosity: 0.6,
    playfulness: 0.9,
    encouragement: 0.95,
    calmness: 0.4,
    directness: 0.5,
    optimism: 0.98,
    confidence: 0.85
  }
};

// Configurable Rules Map
const PERSONALITY_RULES = {
  traitTriggers: {
    empathy: [
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.dominantNeed === 'comfort', weight: 0.20 },
      { condition: (trace: CognitiveTrace) => trace.emotions.some(e => ['sadness', 'fear', 'anger'].includes(e.toLowerCase())), weight: 0.15 }
    ],
    curiosity: [
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.dominantNeed === 'explore', weight: 0.20 },
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.askQuestion === true, weight: 0.10 }
    ],
    playfulness: [
      { condition: (trace: CognitiveTrace) => trace.emotions.some(e => ['joy', 'excitement'].includes(e.toLowerCase())), weight: 0.30 },
      { condition: (trace: CognitiveTrace) => trace.emotions.some(e => ['sadness', 'fear', 'anger'].includes(e.toLowerCase())), weight: -0.40 }
    ],
    encouragement: [
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.dominantNeed === 'motivate', weight: 0.25 },
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.dominantNeed === 'celebrate', weight: 0.20 }
    ],
    calmness: [
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.urgency === 'critical', weight: 0.15 },
      { condition: (trace: CognitiveTrace) => trace.emotions.some(e => ['fear', 'anger'].includes(e.toLowerCase())), weight: 0.10 }
    ],
    directness: [
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.dominantNeed === 'guide', weight: 0.25 },
      { condition: (trace: CognitiveTrace) => trace.storyProgress?.continuityStatus === 'stagnating', weight: 0.20 }
    ],
    optimism: [
      { condition: (trace: CognitiveTrace) => trace.cognitiveDecision?.dominantNeed === 'celebrate', weight: 0.20 },
      { condition: (trace: CognitiveTrace) => trace.storyProgress?.continuityStatus === 'progressing', weight: 0.15 }
    ]
  },
  styleThresholds: {
    direct: 0.6,
    gentle: 0.7
  },
  energyThresholds: {
    high: 1.3,
    low: 0.8
  },
  smoothingFactor: 0.15 // stability carry-over boost
};

export class PersonalityEngine implements CognitiveEngine {
  public name = 'Personality Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const previousDecision = context.previousPersonalityDecision as PersonalityDecision | undefined;
    const activeMascot = trace.mascotCharacter || 'munch';

    // 1. Calculate Trait Expression Scores using the active character's base profile
    const empathyExpr = this.evaluateTrait('empathy', trace, activeMascot, previousDecision);
    const curiosityExpr = this.evaluateTrait('curiosity', trace, activeMascot, previousDecision);
    const playfulnessExpr = this.evaluateTrait('playfulness', trace, activeMascot, previousDecision);
    const encouragementExpr = this.evaluateTrait('encouragement', trace, activeMascot, previousDecision);
    const calmnessExpr = this.evaluateTrait('calmness', trace, activeMascot, previousDecision);
    const directnessExpr = this.evaluateTrait('directness', trace, activeMascot, previousDecision);
    const optimismExpr = this.evaluateTrait('optimism', trace, activeMascot, previousDecision);

    const traitScores = [
      { name: 'empathetic', val: empathyExpr },
      { name: 'curious', val: curiosityExpr },
      { name: 'playful', val: playfulnessExpr },
      { name: 'encouraging', val: encouragementExpr },
      { name: 'calm', val: calmnessExpr },
      { name: 'direct', val: directnessExpr },
      { name: 'optimistic', val: optimismExpr }
    ];

    // Sort descending to get dominant and supporting traits
    traitScores.sort((a, b) => b.val - a.val);
    const dominantTrait = traitScores[0].name as PersonalityDecision['dominantTrait'];
    const supportingTraits = traitScores.filter(t => t.val >= 0.6 && t.name !== dominantTrait).map(t => t.name);

    // 2. Select Communication Style
    let communicationStyle: PersonalityDecision['communicationStyle'] = 'balanced';
    if (directnessExpr > empathyExpr && directnessExpr >= PERSONALITY_RULES.styleThresholds.direct) {
      communicationStyle = 'direct';
    } else if (empathyExpr >= PERSONALITY_RULES.styleThresholds.gentle) {
      communicationStyle = 'gentle';
    }

    // 3. Select Energy Level
    let energyLevel: PersonalityDecision['energyLevel'] = 'medium';
    if (playfulnessExpr + encouragementExpr >= PERSONALITY_RULES.energyThresholds.high) {
      energyLevel = 'high';
    } else if (calmnessExpr >= PERSONALITY_RULES.energyThresholds.low) {
      energyLevel = 'low';
    }

    // 4. Select Expression Intensity
    let expressionIntensity: PersonalityDecision['expressionIntensity'] = 'medium';
    const urgency = trace.cognitiveDecision?.urgency;
    const emotionalIntensity = trace.emotionalState?.intensity ?? 0.5;
    if (urgency === 'critical' || urgency === 'high' || emotionalIntensity >= 0.7) {
      expressionIntensity = 'high';
    } else if (urgency === 'low' && emotionalIntensity <= 0.4) {
      expressionIntensity = 'low';
    }

    // 5. Determine Strategic Action Flags (Respecting Orchestrator decisions strictly)
    const hasNegativeEmotions = trace.emotions.some(e => ['sadness', 'fear', 'anger'].includes(e.toLowerCase()));
    
    // Honor Orchestrator decisions strictly:
    const askQuestion = trace.cognitiveDecision ? trace.cognitiveDecision.askQuestion : (curiosityExpr >= 0.6);
    const validateEmotion = trace.cognitiveDecision ? trace.cognitiveDecision.acknowledgeEmotion : (empathyExpr >= 0.6);
    
    const humorAllowed = playfulnessExpr >= 0.4 && !hasNegativeEmotions;
    const useMetaphors = curiosityExpr >= 0.6 || (trace.cognitiveDecision?.cognitiveLoad ?? 0) >= 0.6;
    const challengeUser = trace.cognitiveDecision?.dominantNeed !== 'comfort' && (trace.storyProgress?.continuityStatus === 'stagnating' || directnessExpr >= 0.6);

    // Expose Response Constraints
    const responseConstraints: ResponseConstraints = {
      avoidHumor: !humorAllowed,
      avoidLongReplies: (trace.cognitiveDecision?.cognitiveLoad ?? 0.5) <= 0.3,
      avoidQuestions: !askQuestion,
      avoidChallenges: !challengeUser,
      preferExamples: trace.cognitiveDecision?.dominantNeed === 'explore',
      preferSteps: trace.cognitiveDecision?.dominantNeed === 'guide'
    };

    // 6. Calculate Stability Score
    let stability = 0.5;
    if (previousDecision) {
      stability = dominantTrait === previousDecision.dominantTrait ? 0.85 : 0.45;
      if (communicationStyle === previousDecision.communicationStyle) {
        stability = Math.min(1.0, stability + 0.15);
      }
    }

    // 7. Calculate Weighted and Smoothed Confidence
    let agreement = 0.8;
    const need = trace.cognitiveDecision?.dominantNeed;
    if (need === 'comfort' && hasNegativeEmotions) agreement = 1.0;
    else if (need === 'comfort' && !hasNegativeEmotions) agreement = 0.4;
    else if (need === 'celebrate' && trace.emotions.some(e => ['joy', 'excitement'].includes(e.toLowerCase()))) agreement = 1.0;

    const storyConf = trace.storyState?.confidence ?? 0.8;
    const memoryConf = trace.memoryState?.memories?.[0]?.confidence ?? 0.8;
    const rawConfidence = Math.min(1.0, Math.max(0.0, agreement * 0.4 + storyConf * 0.3 + memoryConf * 0.3));
    
    // Confidence smoothing logic: prev * 0.2 + current * 0.8
    const confidence = previousDecision 
      ? (previousDecision.confidence * 0.2 + rawConfidence * 0.8)
      : rawConfidence;

    // 8. Save Personality Decision with accurate mascotId
    trace.personalityDecision = {
      dominantTrait,
      communicationStyle,
      energyLevel,
      expressionIntensity,
      humorAllowed,
      useMetaphors,
      validateEmotion,
      challengeUser,
      confidence,
      stability,
      supportingTraits,
      responseConstraints,
      mascotId: activeMascot as MascotCharacter
    };

    return trace;
  }

  private evaluateTrait(
    trait: keyof PersonalityProfile,
    trace: CognitiveTrace,
    activeMascot: string,
    previousDecision?: PersonalityDecision
  ): number {
    const profile = MASCOT_CORE_PROFILES[activeMascot] || MASCOT_CORE_PROFILES.munch;
    let score = profile[trait];
    
    // Add weights from configurable rules
    const rules = PERSONALITY_RULES.traitTriggers[trait as keyof typeof PERSONALITY_RULES.traitTriggers] || [];
    for (const r of rules) {
      if (r.condition(trace)) {
        score += r.weight;
      }
    }

    // Stability Smoothing boost if it was the dominant trait previously
    const traitMap: Record<string, string> = {
      empathy: 'empathetic',
      curiosity: 'curious',
      playfulness: 'playful',
      encouragement: 'encouraging',
      calmness: 'calm',
      directness: 'direct',
      optimism: 'optimistic'
    };
    if (previousDecision && previousDecision.dominantTrait === traitMap[trait]) {
      score += PERSONALITY_RULES.smoothingFactor;
    }

    return score;
  }
}
