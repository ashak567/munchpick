import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { llmConfig } from '@/lib/llm/config';
import {
  CognitiveEngine,
  CognitiveTrace,
  ContextPackage,
  StructuredReflection,
  PathCandidate,
  ResponseSectionType
} from './types';
import { runNLUPipeline } from '../nlu/pipeline';
import { resolveNLUObservations } from '../nlu/resolver';
import { getFallbackObservationsForAgent } from '../orchestrator/agents';
import { MascotCharacter, MascotExpression } from '@/components/Mascot';
import { EmotionEngine } from '../emotion/engine';
import { StoryEngine } from '../story/story';
import { StoryEventsEngine } from '../story/events';
import { StoryProgressEngine } from '../story/continuity';
import { StoryIntelligenceEngine } from '../story/intelligence';
import { MemoryConsolidationEngine } from '../story/memory';
import { CognitiveOrchestratorEngine } from './orchestrator';
import { PersonalityEngine } from './personality';
import { ResponsePlanningEngine } from './response-planner';
import { EmotionalStateEngine } from '../emotion/state';
import { EmotionRegulationEngine } from '../emotion/regulation';
import { EmotionDynamicsEngine } from '../emotion/dynamics';
import { ContextAssemblyEngine } from './context-assembly';
import { PromptBuilderEngine } from './prompt-builder';

export {
  StoryEngine,
  StoryEventsEngine,
  StoryProgressEngine,
  StoryIntelligenceEngine,
  MemoryConsolidationEngine,
  CognitiveOrchestratorEngine,
  PersonalityEngine,
  ResponsePlanningEngine,
  EmotionalStateEngine,
  EmotionRegulationEngine,
  EmotionDynamicsEngine,
  ContextAssemblyEngine,
  PromptBuilderEngine
};

// Initialize the Gemini API client safely
const getGenAI = () => {
  const apiKey = serverEnv.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MOCK_KEY') return null;
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Runner that executes a registered array of cognitive engines in sequence.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getTraceSummary(trace: CognitiveTrace) {
  return {
    state: trace.state,
    emotions: trace.emotions,
    reflectionsCount: trace.reflections?.length || 0,
    readinessScore: trace.readinessScore,
    readinessThreshold: trace.readinessThreshold,
    mascotCharacter: trace.mascotCharacter,
    mascotExpression: trace.mascotExpression,
    generatedPathsCount: trace.generatedPaths?.length || 0
  };
}

/**
 * Runner that executes a registered array of cognitive engines in sequence.
 * Includes timeout protection, recursion guards, duplicate execution checks,
 * deep copying, and structured logging.
 */
export async function runCognitivePipeline(
  engines: CognitiveEngine[],
  initialTrace: CognitiveTrace,
  context: ContextPackage
): Promise<CognitiveTrace> {
  // 1. Recursion Guard
  if (context.__runningPipeline) {
    throw new Error('[CognitivePipeline] Recursive pipeline call detected! Aborting execution.');
  }

  context.__runningPipeline = true;
  context.pipelineExecutionLogs = context.pipelineExecutionLogs || [];

  const GLOBAL_TIMEOUT_MS = 8000;
  const ENGINE_TIMEOUT_MS = 3000;
  const pipelineStart = Date.now();
  const executedEngines = new Set<string>();

  let currentTrace = { ...initialTrace };

  try {
    for (const engine of engines) {
      const elapsed = Date.now() - pipelineStart;
      if (elapsed >= GLOBAL_TIMEOUT_MS) {
        const timeoutMsg = `Global pipeline timeout reached (${elapsed}ms). Aborting execution of remaining engines.`;
        console.warn(`[CognitivePipeline] ${timeoutMsg}`);
        context.pipelineExecutionLogs.push({
          engineName: engine.name,
          status: 'skipped',
          duration: 0,
          error: timeoutMsg
        });
        break;
      }

      const remainingTime = GLOBAL_TIMEOUT_MS - elapsed;
      const currentEngineTimeout = Math.min(ENGINE_TIMEOUT_MS, remainingTime);

      // 2. Duplicate Execution Guard
      if (executedEngines.has(engine.name)) {
        const dupMsg = `Engine "${engine.name}" has already executed in this run. Skipping to prevent duplicate/recursive execution.`;
        console.warn(`[CognitivePipeline] ${dupMsg}`);
        context.pipelineExecutionLogs.push({
          engineName: engine.name,
          status: 'skipped',
          duration: 0,
          error: dupMsg
        });
        continue;
      }
      executedEngines.add(engine.name);

      console.log(`[CognitivePipeline] [${engine.name}] Engine Started`);
      const engineStart = Date.now();

      try {
        // 3. Deep Copy Guard to prevent mutation side-effects
        const traceCopy = JSON.parse(JSON.stringify(currentTrace));

        // 4. Timeout Protection per engine
        const executePromise = engine.execute(traceCopy, context);
        const resultTrace = await withTimeout(
          executePromise,
          currentEngineTimeout,
          `Engine "${engine.name}" execution timed out after ${currentEngineTimeout}ms`
        );

        currentTrace = resultTrace;
        const duration = Date.now() - engineStart;
        const summary = getTraceSummary(currentTrace);

        // Log Engine Finished with duration and output summary
        console.log(`[CognitivePipeline] [${engine.name}] Engine Finished | Duration: ${duration}ms | Output Summary: ${JSON.stringify(summary)}`);
        context.pipelineExecutionLogs.push({
          engineName: engine.name,
          status: 'success',
          duration,
          summary
        });
      } catch (err: any) {
        const duration = Date.now() - engineStart;
        const errMsg = err.message || String(err);
        console.error(`[CognitivePipeline] [${engine.name}] Engine Failed | Duration: ${duration}ms | Failure Reason: ${errMsg}`);
        context.pipelineExecutionLogs.push({
          engineName: engine.name,
          status: 'failed',
          duration,
          error: errMsg
        });
      }
    }
  } finally {
    // Clear recursion guard
    context.__runningPipeline = false;
  }

  return currentTrace;
}

/**
 * Deterministically extracts path candidates from user input.
 * Uses Gemini for parsing and falls back to rule-based keyword splitting.
 */
export async function extractPathsFromText(
  userInput: string,
  chatHistory: string[] = []
): Promise<PathCandidate[]> {
  const genAI = getGenAI();
  if (!genAI) {
    return getFallbackPaths(userInput);
  }

  const model = genAI.getGenerativeModel({
    model: llmConfig.providers.gemini?.auxiliaryModel || llmConfig.providers.gemini?.model || 'gemini-1.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
Analyze the user's message (and conversation history if relevant) to extract possible paths, choices, or things they could try that they are stuck between or considering.
For example, if they say "I don't know whether to order pizza or make a salad", return the two options.
If no paths/options are mentioned, return an empty list.

User Message: "${userInput}"
History: ${JSON.stringify(chatHistory)}

Output JSON schema:
{
  "paths": [
    {
      "text": "The path or choice (e.g. 'Order pizza')",
      "tags": ["lowercase", "tags", "describing", "the", "path"]
    }
  ]
}
`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (parsed && Array.isArray(parsed.paths)) {
      return parsed.paths;
    }
    return [];
  } catch (err) {
    console.warn('[PathExtraction] Gemini path extraction failed, falling back:', err);
    return getFallbackPaths(userInput);
  }
}

function getFallbackPaths(userInput: string): PathCandidate[] {
  const parts = userInput.split(/\bor\b|\bvs\b/i);
  if (parts.length >= 2) {
    return parts.map(p => ({
      text: p.trim().replace(/^[,\.\s\?\!]+|[,\.\s\?\!]+$/g, ''),
      tags: ['fallback']
    }));
  }
  return [];
}

/**
 * NLU Engine Plugin.
 * Runs the Layer 1 NLU Pipeline and resolves observations, then extracts possible paths.
 */
export class NluEnginePlugin implements CognitiveEngine {
  public name = 'NLU Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    // 1. Run core NLU pipeline
    const rawAnalysis = await runNLUPipeline(context);

    // 2. Resolve observations using the resolver
    // Mock history empty array for the resolver call
    const resolved = resolveNLUObservations(rawAnalysis, context as any, []);

    // 3. Save observations back into the context so downstream engines can access them
    context.observations = context.observations || [];

    // Map properties from resolved to AgentObservation format
    const mappings: Array<{ key: keyof typeof resolved; label: string }> = [
      { key: 'state_signals', label: 'state_signals' },
      { key: 'certainties', label: 'certainties' },
      { key: 'goals', label: 'goals' },
      { key: 'ambiguities', label: 'ambiguities' },
      { key: 'readiness_signals', label: 'readiness_signals' }
    ];

    for (const map of mappings) {
      const items = resolved[map.key] as any[];
      if (items && items.length > 0) {
        context.observations.push({
          agent_name: 'NLU Agent',
          type: 'nlu',
          key: map.key,
          value: items,
          confidence: Math.max(...items.map((i: any) => i.confidence || 0.8)),
          reasoning: `Resolved ${items.length} ${map.label} from pipeline.`
        });
      }
    }

    // 3.5 Fallback / Resolve category
    const categoryExists = context.observations.some((o: any) => o.key === 'detected_category');
    if (!categoryExists) {
      let category = 'Other';
      const inputLower = context.user_input.toLowerCase();
      if (/pizza|sushi|pasta|burger|food|eat|dinner|lunch|breakfast|restaurant/i.test(inputLower)) {
        category = 'Food';
      } else if (/movie|film|netflix|show|watch|game|youtube|music|book/i.test(inputLower)) {
        category = 'Entertainment';
      } else if (/run|gym|work|study|code|read|sleep|clean/i.test(inputLower)) {
        category = 'Activities';
      } else if (/buy|shop|clothes|shoes|amazon|gadget/i.test(inputLower)) {
        category = 'Shopping';
      }
      context.observations.push({
        agent_name: 'NLU Agent',
        type: 'nlu',
        key: 'detected_category',
        value: category,
        confidence: 0.8,
        reasoning: 'Fallback classification based on user input.'
      });
    }

    // 4. Extract possible paths
    const historyStrings = (context.chatHistory || []).map((m: any) => m.content);
    const extractedPaths = await extractPathsFromText(context.user_input, historyStrings);

    // 5. Progressive Path Evolution: merge new paths with accumulated paths in metadata
    const currentPaths = [...(trace.generatedPaths || [])];
    if (extractedPaths.length > 0) {
      // Avoid duplicate paths
      extractedPaths.forEach(newP => {
        const duplicate = currentPaths.some(p => p.text.toLowerCase() === newP.text.toLowerCase());
        if (!duplicate) {
          currentPaths.push(newP);
        }
      });
    }

    return {
      ...trace,
      generatedPaths: currentPaths
    };
  }
}

/**
 * Emotion Engine Plugin.
 * Analyzes current input and NLU observations to determine active emotions.
 * Delegates to the modular EmotionEngine.
 */
export const EmotionEnginePlugin = EmotionEngine;

/**
 * Mascot Specialist Engine.
 * Decides which mascot should voice the output based on trace observations.
 */
const MASCOT_PROFILES: Record<string, { identity: string; behavior: string; speakingStyle: string; emotionalStyle: string; interactionStyle: string }> = {
  munch: {
    identity: "Munch, a friendly and balanced decision guide mascot.",
    behavior: "Guides the user calmly through options, highlighting trade-offs without making the choice for them.",
    speakingStyle: "Friendly, balanced, structured, and clear.",
    emotionalStyle: "Calm, objective, and supportive.",
    interactionStyle: "Dialogue-based exploration and structured layout guidance."
  },
  pandy: {
    identity: "Pandy, a comforting and gentle panda mascot who values rest, pace, and comfort.",
    behavior: "Provides deep emotional validation, reminding the user that it is okay to stop, rest, or feel tired.",
    speakingStyle: "Soft, gentle, warm, and highly comforting.",
    emotionalStyle: "Very warm, soothing, and deeply validating.",
    interactionStyle: "Comfort-first, non-demanding, supportive presence."
  },
  froggy: {
    identity: "Froggy, a grounded and zen frog mascot specializing in calm, mindfulness, and breathing space.",
    behavior: "Helps users slow down when overwhelmed, offering simple grounding techniques.",
    speakingStyle: "Zen-like, slow, relaxed, and concise.",
    emotionalStyle: "Extremely calm, grounded, and tranquil.",
    interactionStyle: "Grounding-first, focus on simplicity and present-moment safety."
  },
  dobby: {
    identity: "Dobby, an energetic, motivational, and action-oriented puppy mascot.",
    behavior: "Encourages the user to take small steps, build momentum, and celebrate action.",
    speakingStyle: "Energetic, enthusiastic, brief, and highly positive.",
    emotionalStyle: "High-energy, optimistic, and cheerleading.",
    interactionStyle: "Challenge-first, action-biased, and encouraging."
  },
  chicky: {
    identity: "Chicky, a bright, bubbly, and optimistic little chick mascot who loves celebration.",
    behavior: "Focuses on positive progress, celebrating wins, and bringing a joyful attitude.",
    speakingStyle: "Cheerful, lively, playful, and bright.",
    emotionalStyle: "Bubbly, joyful, and highly encouraging.",
    interactionStyle: "Optimism-first, positive framing, and celebration-biased."
  },
  ollie: {
    identity: "Ollie, a wise, curious, and thoughtful owl mascot specializing in new perspectives.",
    behavior: "Asks reflective questions to help the user reframe their problems or look at them from another angle.",
    speakingStyle: "Curious, thoughtful, philosophical, and inquisitive.",
    emotionalStyle: "Objective, curious, and neutral.",
    interactionStyle: "Perspective-first, reframing, and reflective questioning."
  },
  ellie: {
    identity: "Ellie, a reassuring, loyal, and empathetic elephant mascot.",
    behavior: "Protects the user's emotional safety, reassuring them when they feel anxious or doubtful.",
    speakingStyle: "Steady, reassuring, warm, and protective.",
    emotionalStyle: "Empathetic, reassuring, and highly stable.",
    interactionStyle: "Safety-first, reassurance-biased, and supportive companionship."
  }
};

export class MascotSpecialistEngine implements CognitiveEngine {
  public name = 'Mascot Specialist Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    let mascot: MascotCharacter = 'munch';
    let reason = 'Default balanced guide';
    const dominantEmotion = trace.emotions[0] || 'calm';

    const guidance = trace.emotionalGuidance;
    if (guidance) {
      const style = guidance.responseStyle;
      if (style === 'comfort') {
        mascot = 'pandy';
        reason = 'Mascot assigned comfort response style: Pandy specializes in comfort and rest';
      } else if (style === 'ground') {
        mascot = 'froggy';
        reason = 'Mascot assigned ground response style: Froggy specializes in calm';
      } else if (style === 'encourage') {
        mascot = 'dobby';
        reason = 'Mascot assigned encourage response style: Dobby specializes in encouragement';
      } else if (style === 'celebrate') {
        mascot = 'chicky';
        reason = 'Mascot assigned celebrate response style: Chicky specializes in optimism and celebration';
      } else if (style === 'clarify' || style === 'reflect') {
        mascot = 'ollie';
        reason = 'Mascot assigned clarify/reflect response style: Ollie specializes in perspective';
      }
    } else {
      // Assign mascot based on legacy specialty
      if (dominantEmotion === 'tired' || dominantEmotion === 'exhausted' || dominantEmotion === 'sad') {
        mascot = 'pandy';
        reason = 'Dominant fatigue or sadness: Pandy specializes in comfort and rest';
      } else if (dominantEmotion === 'anxious' || dominantEmotion === 'worry' || dominantEmotion === 'unsure') {
        mascot = 'ellie';
        reason = 'Dominant anxiety or doubt: Ellie specializes in emotional safety and reassurance';
      } else if (dominantEmotion === 'overwhelmed' || dominantEmotion === 'busy') {
        mascot = 'froggy';
        reason = 'Dominant overload or stress: Froggy specializes in calm';
      } else if (dominantEmotion === 'happy' || dominantEmotion === 'joyful') {
        mascot = 'chicky';
        reason = 'Dominant joy: Chicky specializes in optimism and celebration';
      } else if (trace.state === 'Clarifying' || dominantEmotion === 'reflective') {
        mascot = 'ollie';
        reason = 'Active reflection or clarifying: Ollie specializes in perspective';
      } else if (trace.state === 'Exploring' && /action|energy|start/i.test(context.importance || '')) {
        mascot = 'dobby';
        reason = 'Action-oriented exploration: Dobby specializes in encouragement';
      }
    }

    // Bind expression
    let expression: MascotExpression = 'idle';
    if (trace.state === 'Clarifying' || trace.state === 'Understanding') {
      expression = 'thinking';
    } else if (dominantEmotion === 'joyful' || trace.state === 'Choosing') {
      expression = 'happy';
    } else if (dominantEmotion === 'tired' || dominantEmotion === 'anxious') {
      expression = 'wry';
    }

    const profile = MASCOT_PROFILES[mascot] || MASCOT_PROFILES.munch;

    return {
      ...trace,
      mascotCharacter: mascot,
      mascotExpression: expression,
      mascotReason: reason,
      mascotDecision: {
        mascotId: mascot,
        identity: profile.identity,
        behavior: profile.behavior,
        speakingStyle: profile.speakingStyle,
        emotionalStyle: profile.emotionalStyle,
        interactionStyle: profile.interactionStyle
      }
    };
  }
}

/**
 * Deterministic Reflection Engine.
 * Converts raw context and cognitive observations into structured, gentle reflections.
 */
export class ReflectionEngine implements CognitiveEngine {
  public name = 'Reflection Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const reflections: StructuredReflection[] = [];

    // Determine which section types the planner has requested
    const plan = trace.responsePlan;
    const requestedSections = plan
      ? new Set(plan.sections.map(s => s.type))
      : null; // null means legacy mode: generate all sections

    // Helper to check whether we should produce a certain section kind
    const shouldGenerate = (sectionType: ResponseSectionType): boolean => {
      if (!requestedSections) return true; // no plan → generate everything (legacy)
      return requestedSections.has(sectionType);
    };
    const getObservationsOfAgent = (agentName: string, key: string): any[] => {
      const obs = context.observations || [];
      return obs.filter((o: any) => o.agent_name === agentName && o.key === key);
    };

    // Note: Raw emotions are not inspected here for modern pipelines. Emotion processing is fully encapsulated within
    // CognitiveOrchestratorEngine and PersonalityEngine.
    // However, for backward compatibility with old tests where these engines are not present, we perform a fallback check:
    if (!trace.cognitiveDecision && !trace.personalityDecision) {
      if (shouldGenerate('acknowledgement') || shouldGenerate('reflection')) {
        const emotionalState = trace.emotionalState;
        const dominantEmotion = emotionalState ? emotionalState.primaryEmotion : (trace.emotions && trace.emotions.length > 0 ? trace.emotions[0] : null);

        if (dominantEmotion) {
          let insight = '';
          let guidance = '';
          const confidence = emotionalState ? emotionalState.confidence : 0.8;

          if (dominantEmotion === 'tired' || dominantEmotion === 'exhausted') {
            insight = "User physical or cognitive energy appears depleted.";
            guidance = "Acknowledge fatigue gently without demanding high-energy engagement.";
          } else if (dominantEmotion === 'overwhelmed' || dominantEmotion === 'busy') {
            insight = "User is experiencing high cognitive load from competing demands.";
            guidance = "Provide calming presence and avoid introducing additional complexity.";
          } else if (dominantEmotion === 'anxious' || dominantEmotion === 'worry' || dominantEmotion === 'unsure') {
            insight = "User shows hesitation or uncertainty regarding current choices.";
            guidance = "Validate emotional uncertainty before moving forward.";
          } else if (dominantEmotion === 'joyful' || dominantEmotion === 'happy') {
            insight = "User is carrying bright, positive emotional momentum.";
            guidance = "Share in the user's positive state warmly.";
          } else if (dominantEmotion === 'reflective') {
            insight = "User is taking contemplative space to evaluate choices thoughtfully.";
            guidance = "Honor the reflective pause and support self-discovery.";
          }

          if (insight) {
            reflections.push({
              observation: `Dominant emotion detected as ${dominantEmotion}.`,
              insight,
              guidance,
              reflection: `${insight} ${guidance}`.trim(),
              confidence,
              type: 'emotion'
            });
          }
        }

        if (emotionalState && emotionalState.emotionalConsistency === 'conflicted') {
          const insight = "User shows mixed or conflicting emotional signals across recent turns.";
          const guidance = "Acknowledge the emotional tension without forcing quick resolution.";
          reflections.push({
            observation: `Emotional state is conflicted (stability: ${emotionalState.stability.toFixed(2)}).`,
            insight,
            guidance,
            reflection: `${insight} ${guidance}`.trim(),
            confidence: emotionalState.confidence,
            type: 'conflict'
          });
        }
      }
    }
    // 2. Analyze NLU State Signals (like cognitive fatigue or overload)
    if (shouldGenerate('reflection')) {
      const nluStateObs = getObservationsOfAgent('NLU Agent', 'state_signals');
      if (nluStateObs.length > 0 && Array.isArray(nluStateObs[0].value)) {
        const signals = nluStateObs[0].value.map((s: any) => s.signal);
        if (signals.includes('cognitive_fatigue') || signals.includes('mental_overload')) {
          const insight = "Cognitive fatigue or mental overload detected in interaction signals.";
          const guidance = "Keep interactions lightweight and reduce decision pressure.";
          reflections.push({
            observation: "NLU detected cognitive fatigue or mental overload.",
            insight,
            guidance,
            reflection: `${insight} ${guidance}`.trim(),
            confidence: 0.85,
            type: 'energy'
          });
        }
      }
    }

    // 3. Analyze Conflicts or Ambiguities
    const hasConflicts = context.conflicts && context.conflicts.length > 0;
    const nluAmbiguityObs = getObservationsOfAgent('NLU Agent', 'ambiguities');
    const hasAmbiguities = nluAmbiguityObs.length > 0 && Array.isArray(nluAmbiguityObs[0].value) && nluAmbiguityObs[0].value.length > 0;

    if (hasConflicts) {
      const insight = "User is navigating conflicting priorities or competing decision pathways.";
      const guidance = "Help clarify the underlying trade-offs between competing desires.";
      reflections.push({
        observation: "Orchestrator identified conflicting hypotheses in decision pathways.",
        insight,
        guidance,
        reflection: `${insight} ${guidance}`.trim(),
        confidence: 0.88,
        type: 'conflict'
      });
    } else if (hasAmbiguities) {
      const insight = "User's intended path or options are currently ambiguous or evolving.";
      const guidance = "Invite gentle clarification on what the user hopes to achieve.";
      reflections.push({
        observation: "NLU identified ambiguities in options or intent.",
        insight,
        guidance,
        reflection: `${insight} ${guidance}`.trim(),
        confidence: 0.78,
        type: 'conflict'
      });
    }

    // 4. Analyze Paths and Options
    if (shouldGenerate('reflection') && trace.generatedPaths && trace.generatedPaths.length > 0) {
      const pathTexts = trace.generatedPaths.map(p => p.text);
      let insight = '';
      if (pathTexts.length === 1) {
        insight = `User is considering the path: "${pathTexts[0]}".`;
      } else if (pathTexts.length === 2) {
        insight = `User is weighing options between "${pathTexts[0]}" and "${pathTexts[1]}".`;
      } else {
        insight = `User is exploring multiple directions: ${pathTexts.map(p => `"${p}"`).join(', ')}.`;
      }
      const guidance = "Frame the options clearly to support balanced evaluation.";

      reflections.push({
        observation: `Identified ${pathTexts.length} paths under consideration.`,
        insight,
        guidance,
        reflection: `${insight} ${guidance}`.trim(),
        confidence: 0.92,
        type: 'path'
      });
    }

    // 4.5 Analyze Story Progress
    if (shouldGenerate('story_reference') && trace.storyProgress) {
      const progress = trace.storyProgress;
      let insight = '';
      let guidance = '';
      if (progress.continuityStatus === 'stagnating') {
        insight = `Story arc "${progress.linkedArc}" indicates repeated circling or stagnation.`;
        guidance = "Gently illuminate the pattern and invite a fresh perspective.";
      } else if (progress.continuityStatus === 'pivoting') {
        insight = `User is making an important directional pivot in arc "${progress.linkedArc}".`;
        guidance = "Recognize the transition and anchor new intentions.";
      } else if (progress.continuityStatus === 'progressing') {
        insight = `User is demonstrating steady forward progress in arc "${progress.linkedArc}".`;
        guidance = "Reinforce constructive momentum and celebrate progress.";
      }

      if (insight) {
        reflections.push({
          observation: `Story progress status is ${progress.continuityStatus} for arc "${progress.linkedArc}".`,
          insight,
          guidance,
          reflection: `${insight} ${guidance}`.trim(),
          confidence: progress.confidence,
          type: 'general'
        });
      }
    }

    // 4.6 Analyze Story Insights
    if (shouldGenerate('story_reference') && trace.storyInsight) {
      const insightObj = trace.storyInsight;
      let insight = '';
      let guidance = '';
      const hasResilience = insightObj.recurringPatterns.some(p => p.title === 'Recovers quickly from setbacks' && p.active && p.confidence > 0.6);

      if (hasResilience) {
        insight = "User has demonstrated a recurring pattern of recovering quickly from setbacks.";
        guidance = "Highlight past resilience as an enduring internal strength.";
      } else if (insightObj.recurringFears.length > 0) {
        insight = "Current challenge echoes recurring fears from past story events.";
        guidance = "Offer reassuring context that familiar challenges can be navigated.";
      }

      if (insight) {
        reflections.push({
          observation: `Story insight detected patterns or fears.`,
          insight,
          guidance,
          reflection: `${insight} ${guidance}`.trim(),
          confidence: insightObj.confidence,
          type: 'general'
        });
      }
    }

    // 4.7 Analyze Consolidated Memories
    if (shouldGenerate('memory_reference') && trace.memoryState) {
      const activeGoalMemories = trace.memoryState.memories.filter(
        m => m.category === 'goal' && !m.archived && m.reinforcementCount >= 2
      );
      if (activeGoalMemories.length > 0) {
        const insight = `User has an established, reinforced commitment to goal "${activeGoalMemories[0].title}".`;
        const guidance = "Respect the user's ongoing dedication to this long-term objective.";
        reflections.push({
          observation: `Detected reinforced goal memory for arc "${activeGoalMemories[0].title}".`,
          insight,
          guidance,
          reflection: `${insight} ${guidance}`.trim(),
          confidence: activeGoalMemories[0].confidence,
          type: 'general'
        });
      }
    }

    // 4.8 Incorporate Cognitive Orchestrator Decision
    if (shouldGenerate('guidance') && trace.cognitiveDecision) {
      const need = trace.cognitiveDecision.dominantNeed;
      let insight = '';
      let guidance = '';
      const observation = `Orchestrator dominant need is "${need}".`;

      if (need === 'comfort') {
        insight = "User's primary cognitive need is emotional comfort and validation.";
        guidance = "Provide compassionate presence and validate feelings before problem-solving.";
      } else if (need === 'celebrate') {
        insight = "User achieved a meaningful milestone worthy of celebration.";
        guidance = "Express shared joy and highlight positive accomplishments.";
      } else if (need === 'guide') {
        insight = "User is seeking active guidance and structural direction.";
        guidance = "Offer structured framing and actionable next steps.";
      } else if (need === 'motivate') {
        insight = "User needs encouragement and motivational reinforcement.";
        guidance = "Inspire confidence and emphasize the value of sustained effort.";
      } else if (need === 'explore') {
        insight = "User is in an open, exploratory phase considering possibilities.";
        guidance = "Foster curious exploration and broaden perspective.";
      } else if (need === 'ground') {
        insight = "User needs grounding back to core values or past lessons.";
        guidance = "Anchor to stable foundations and proven personal principles.";
      } else if (need === 'listen') {
        insight = "User needs attentive, non-judgmental listening and space to unpack thoughts.";
        guidance = "Listen attentively without offering premature advice or unsolicited solutions.";
      }

      if (insight) {
        reflections.push({
          observation,
          insight,
          guidance,
          reflection: `${insight} ${guidance}`.trim(),
          confidence: 0.95,
          type: 'general'
        });
      }
    }

    // 4.9 Incorporate Personality Decision Style
    if (shouldGenerate('reflection') && trace.personalityDecision) {
      const decision = trace.personalityDecision;
      let insight = '';
      let guidance = '';

      if (decision.dominantTrait === 'empathetic') {
        insight = "Personality style emphasizes deep empathy and careful listening.";
        guidance = "Lead with warmth, empathy, and emotional attunement.";
      } else if (decision.dominantTrait === 'curious') {
        insight = "Personality style emphasizes curious inquiry and learning.";
        guidance = "Ask thoughtful questions and explore the user's perspective.";
      } else if (decision.dominantTrait === 'encouraging') {
        insight = "Personality style emphasizes uplifting encouragement and optimism.";
        guidance = "Provide positive reinforcement and supportive energy.";
      } else if (decision.dominantTrait === 'calm') {
        insight = "Personality style emphasizes calm, steady, grounded pacing.";
        guidance = "Maintain a soothing, unhurried, reassuring presence.";
      } else if (decision.dominantTrait === 'playful' && decision.humorAllowed) {
        insight = "Personality style allows lighthearted, playful warmth.";
        guidance = "Bring playful joy and cheerfulness where appropriate.";
      } else if (decision.dominantTrait === 'direct') {
        insight = "Personality style emphasizes clarity, conciseness, and factual focus.";
        guidance = "Communicate with direct clarity and actionable precision.";
      } else if (decision.dominantTrait === 'optimistic') {
        insight = "Personality style emphasizes positive outlook and hope.";
        guidance = "Highlight positive potential and hopeful horizons.";
      }

      if (insight) {
        reflections.push({
          observation: `Personality engine resolved dominant trait "${decision.dominantTrait}".`,
          insight,
          guidance,
          reflection: `${insight} ${guidance}`.trim(),
          confidence: decision.confidence,
          type: 'general'
        });
      }
    }

    // 5. Default General Reflection if none generated
    if (reflections.length === 0) {
      const insight = "User is engaging in open dialogue.";
      const guidance = "Maintain an open, attentive, and supportive companion presence.";
      reflections.push({
        observation: "Standard greeting context.",
        insight,
        guidance,
        reflection: `${insight} ${guidance}`.trim(),
        confidence: 0.7,
        type: 'general'
      });
    }

    // 6. Defensive Guard: Limit reflections to maximum of 3 (top by confidence)
    const uniqueReflections = reflections.filter(
      (reflection, index, self) =>
        index === self.findIndex(
          r => r.reflection.trim() === reflection.reflection.trim()
        )
    );

    const limitedReflections =
      uniqueReflections.length > 3
        ? uniqueReflections
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3)
        : uniqueReflections;

    // Return the updated trace
    return {
      ...trace,
      reflections: limitedReflections
    };
  }
}
