import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CognitiveTrace, ContextPackage } from '@/lib/reflection/types';
import { runCognitivePipeline, NluEnginePlugin, EmotionEnginePlugin, EmotionalStateEngine, EmotionRegulationEngine, EmotionDynamicsEngine, StoryEngine, StoryEventsEngine, StoryProgressEngine, StoryIntelligenceEngine, MemoryConsolidationEngine, CognitiveOrchestratorEngine, PersonalityEngine } from '@/lib/reflection/engine';
import { SPECULATIVE_CACHE, ACTIVE_CONTROLLERS, PIPELINE_VERSION, ENGINE_VERSIONS, evaluatePredictionConfidence, generateFingerprints, setSpeculativeState, normalizeText } from '@/lib/reflection/speculative';

export async function POST(request: NextRequest) {
  let controller: AbortController | null = null;
  let draftId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { draftId: reqDraftId, chatId, partialText } = await request.json();
    draftId = reqDraftId;

    if (!draftId || !chatId || typeof partialText !== 'string') {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // 1. Cancellation Token Management
    controller = new AbortController();
    const previousController = ACTIVE_CONTROLLERS.get(draftId);
    if (previousController) {
      previousController.abort();
    }
    ACTIVE_CONTROLLERS.set(draftId, controller);

    const confidence = evaluatePredictionConfidence(partialText);

    // 2. Fetch Active Chat from DB to load previous state
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!chatData) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }

    // Fetch last mascot message for nlu_metadata
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(10);

    let previousStoryState: any = undefined;
    let previousStoryProgress: any = undefined;
    let previousStoryInsight: any = undefined;
    let previousMemoryState: any = undefined;
    let previousCognitiveDecision: any = undefined;
    let previousPersonalityDecision: any = undefined;

    if (recentMessages && recentMessages.length > 0) {
      const lastMascotMsg = [...recentMessages].find((m: any) => m.sender === 'mascot');
      if (lastMascotMsg && lastMascotMsg.nlu_metadata) {
        let metadata = lastMascotMsg.nlu_metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch {}
        }
        if (metadata) {
          previousStoryState = metadata.storyState;
          previousStoryProgress = metadata.storyProgress;
          previousStoryInsight = metadata.storyInsight;
          previousMemoryState = metadata.memoryState;
          previousCognitiveDecision = metadata.cognitiveDecision;
          previousPersonalityDecision = metadata.personalityDecision;
        }
      }
    }

    if (previousStoryState) {
      previousStoryState.events = previousStoryState.events || [];
    }

    // 3. Build Speculative Context Package
    const context: ContextPackage = {
      user_id: user.id,
      user_input: partialText,
      options: [],
      profile_beliefs: [],
      relevant_memories: [],
      decision_history: [],
      chatHistory: recentMessages ? [...recentMessages].reverse() : [],
      previousStoryState,
      previousStoryProgress,
      previousStoryInsight,
      previousMemoryState,
      previousCognitiveDecision,
      previousPersonalityDecision
    };

    const initialTrace: CognitiveTrace = {
      state: chatData.state || 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0.0,
      readinessThreshold: 0.65,
      mascotCharacter: 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: [],
      confidence: 1.0,
      activeTopicKey: 'general',
      storyState: previousStoryState,
      storyProgress: previousStoryProgress,
      storyInsight: previousStoryInsight,
      memoryState: previousMemoryState,
      cognitiveDecision: previousCognitiveDecision,
      personalityDecision: previousPersonalityDecision
    };

    // Upstream pipeline engines
    const pipeline = [
      new NluEnginePlugin(),
      new EmotionEnginePlugin(),
      new EmotionalStateEngine(),
      new EmotionRegulationEngine(),
      new EmotionDynamicsEngine(),
      new StoryEngine(),
      new StoryEventsEngine(),
      new StoryProgressEngine(),
      new StoryIntelligenceEngine(),
      new MemoryConsolidationEngine(),
      new CognitiveOrchestratorEngine(),
      new PersonalityEngine()
    ];

    // Run Speculative execution step-by-step with cancellation checking
    let currentTrace = { ...initialTrace };
    for (const engine of pipeline) {
      if (controller.signal.aborted) {
        return NextResponse.json({ error: 'Speculative computation aborted.' }, { status: 499 });
      }
      currentTrace = await engine.execute(currentTrace, context);
    }

    // 4. Cache final state if confidence gate is met
    if (confidence >= 0.35 && !controller.signal.aborted) {
      const fingerprints = generateFingerprints(currentTrace);
      setSpeculativeState(draftId, {
        draft: partialText,
        normalizedDraft: normalizeText(partialText),
        pipelineVersion: PIPELINE_VERSION,
        engineVersions: ENGINE_VERSIONS,
        fingerprints,
        cognitiveTrace: currentTrace,
        completedEngines: pipeline.map(e => e.name),
        timestamp: Date.now(),
        predictionConfidence: confidence
      });
    }

    // Clean active controller mapping
    if (ACTIVE_CONTROLLERS.get(draftId) === controller) {
      ACTIVE_CONTROLLERS.delete(draftId);
    }

    return NextResponse.json({
      success: true,
      predictionConfidence: confidence,
      predictedEmotion: currentTrace.emotions,
      predictedMascot: currentTrace.mascotCharacter,
      predictedReadinessScore: currentTrace.readinessScore
    });

  } catch (error: any) {
    if (error.message === 'Speculative computation aborted.') {
      return NextResponse.json({ error: 'Speculative computation aborted.' }, { status: 499 });
    }
    console.error('[POST /api/chat/speculative] Error running speculative engine:', error);
    return NextResponse.json({ error: 'Internal speculative error.' }, { status: 500 });
  } finally {
    if (draftId && ACTIVE_CONTROLLERS.get(draftId) === controller) {
      ACTIVE_CONTROLLERS.delete(draftId);
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { draftId } = await request.json();
    if (draftId) {
      SPECULATIVE_CACHE.delete(draftId);
      const controller = ACTIVE_CONTROLLERS.get(draftId);
      if (controller) {
        controller.abort();
        ACTIVE_CONTROLLERS.delete(draftId);
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
