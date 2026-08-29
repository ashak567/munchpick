import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';
import { llmConfig } from '@/lib/llm/config';
import { MunchContextBuilder } from '@/lib/context/builder';
import {
  runCognitivePipeline,
  NluEnginePlugin,
  EmotionEnginePlugin,
  MascotSpecialistEngine,
  ReflectionEngine,
  StoryEngine,
  StoryEventsEngine,
  StoryProgressEngine,
  StoryIntelligenceEngine,
  MemoryConsolidationEngine,
  CognitiveOrchestratorEngine,
  PersonalityEngine,
  ResponsePlanningEngine,
  ContextAssemblyEngine,
  PromptBuilderEngine
} from '@/lib/reflection/engine';
import { DecisionReadinessEngine } from '@/lib/reflection/readiness';
import { CognitiveTrace, ContextPackage, PromptPackage } from '@/lib/reflection/types';
import { SPECULATIVE_CACHE, PIPELINE_VERSION, resolveInvalidatedEngines } from '@/lib/reflection/speculative';
import { analyzeTopics } from '@/lib/context/builder';
import { EmotionalStateEngine } from '@/lib/emotion/state';
import { EmotionRegulationEngine } from '@/lib/emotion/regulation';
import { EmotionDynamicsEngine } from '@/lib/emotion/dynamics';
import { LLMGateway } from '@/lib/llm/gateway';
import { ResponseValidator } from '@/lib/validation/validator';
import { ResponseExpressionEngine } from '@/lib/expression/engine';
import { jsonNoStore } from '@/lib/api-headers';

function stripPromptContent(pkg?: PromptPackage) {
  if (!pkg) return undefined;
  const { sections, ...rest } = pkg;
  return {
    ...rest,
    sections: (sections || []).map(({ content, ...sRest }) => sRest)
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

// Initialize Gemini safely
const getGeminiModel = () => {
  const apiKey = serverEnv.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MOCK_KEY') return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: llmConfig.providers.gemini?.auxiliaryModel || llmConfig.providers.gemini?.model || 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250
    }
  });
};

/**
 * Gemini Voice Narrator.
 * Gemini serves strictly as the narrator (the voice) for Munch, translating the
 * deterministic Structured Reflections from the Cognitive Trace into warm mascot dialogue.
 */
async function generateMascotVoice(
  trace: CognitiveTrace,
  context: ContextPackage
): Promise<any> {
  if (!trace.promptPackage) {
    throw new Error('Prompt package is missing from trace.');
  }

  const gateway = new LLMGateway();
  return gateway.generate({
    promptPackage: trace.promptPackage
  });
}

/**
 * Periodic Conversation Summarizer.
 * Summarizes the emotional arc and observations after 20-30 message turns.
 */
async function generateConversationSummary(
  chatId: string,
  userId: string,
  messages: any[]
): Promise<void> {
  const model = getGeminiModel();
  if (!model) return;

  const prompt = `
Analyze the following chat history and summarize:
1. A brief summary of the conversation.
2. The emotional arc (e.g. from stressed to calm).
3. Discovered interests or tags (e.g. comfort food).
4. Unresolved conflicts/dilemmas.
5. Decisions made or contemplated.

Chat History:
${messages.map(m => `${m.sender === 'user' ? 'User' : m.mascot_character}: ${m.content}`).join('\n')}

Output must follow this JSON schema:
{
  "summary": "Summary of the conversation",
  "emotional_arc": ["list", "of", "emotions", "felt"],
  "discovered_interests": ["tags", "or", "interests"],
  "unresolved_conflicts": ["any", "remaining", "conflicts"],
  "decisions_made": ["decisions", "selected"]
}
`;

  try {
    const response = await model.generateContent(prompt);
    const parsed = JSON.parse(response.response.text().trim());

    const supabase = await createClient();
    await supabase.from('conversation_summaries').insert({
      chat_id: chatId,
      summary: parsed.summary,
      emotional_arc: parsed.emotional_arc || [],
      discovered_interests: parsed.discovered_interests || [],
      unresolved_conflicts: parsed.unresolved_conflicts || [],
      decisions_made: parsed.decisions_made || []
    });

    // Extract memory candidates
    if (parsed.summary && parsed.summary.length > 10) {
      await supabase.from('memory_candidates').insert({
        user_id: userId,
        summary: `Munch noticed during a chat: ${parsed.summary}`,
        status: 'pending'
      });
    }
  } catch (err) {
    console.error('[Summarizer] Failed to summarize conversation:', err);
  }
}

// GET API endpoint
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const customChatId = url.searchParams.get('chatId');

    let activeChat = null;
    if (customChatId) {
      const { data } = await supabase
        .from('chats')
        .select('*')
        .eq('id', customChatId)
        .eq('user_id', user.id)
        .maybeSingle();
      activeChat = data;
    }

    // Fallback to active chat if not found or not specified (deterministically pick latest updated)
    if (!activeChat) {
      const { data: activeChats } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1);
      activeChat = activeChats && activeChats.length > 0 ? activeChats[0] : null;
    }

    // 2. If no active chat, initialize one
    if (!activeChat) {
      // Look up preferred mascot from user profile / preferences
      const { data: profile } = await supabase
        .from('users')
        .select('preferred_mascot')
        .eq('id', user.id)
        .maybeSingle();

      const prefMascot = profile?.preferred_mascot || 'munch';

      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          status: 'active',
          state: 'Listening',
          metadata: {
            primaryMascot: prefMascot,
            lastMascot: prefMascot,
            activeTopicKey: 'general',
            branches: {
              general: { state: 'Listening', paths: [], mascot: prefMascot }
            }
          }
        })
        .select()
        .single();

      if (chatError) throw chatError;
      activeChat = newChat;

      // Insert default welcome message
      await supabase.from('chat_messages').insert({
        chat_id: activeChat.id,
        sender: 'mascot',
        content: `What's on your mind today? I'm here to listen.`,
        mascot_character: prefMascot,
        mascot_expression: 'idle'
      });
    }

    // 3. Load chat messages
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', activeChat.id)
      .order('created_at', { ascending: true });

    return jsonNoStore({
      chat: activeChat,
      messages: messages || []
    });
  } catch (error: any) {
    console.error('GET /api/chat failed:', error);
    return jsonNoStore({ error: error.message || 'Server error.' }, { status: 500 });
  }
}

// POST API endpoint
export async function POST(request: NextRequest) {
  let supabase: any = null;
  let activeChat: any = null;
  let chatMetadata: any = {};
  let userMessage: any = null;
  let activeTopicKey = 'general';
  let branches: any = {};
  let finalTrace: any = null;

  try {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return jsonNoStore({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { content, draftId } = await request.json();
    if (!content || !content.trim()) {
      return jsonNoStore({ error: 'Content cannot be empty.' }, { status: 400 });
    }

    // 1. Retrieve active chat (deterministically pick latest updated)
    const { data: activeChats } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1);

    const activeChatData = activeChats && activeChats.length > 0 ? activeChats[0] : null;

    if (!activeChatData) {
      // Create new chat
      const { data: profile } = await supabase
        .from('users')
        .select('preferred_mascot')
        .eq('id', user.id)
        .maybeSingle();

      const prefMascot = profile?.preferred_mascot || 'munch';

      const { data: newChat, error: newChatErr } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          status: 'active',
          state: 'Listening',
          metadata: {
            primaryMascot: prefMascot,
            lastMascot: prefMascot,
            activeTopicKey: 'general',
            branches: {
              general: { state: 'Listening', paths: [], mascot: prefMascot }
            }
          }
        })
        .select()
        .single();

      if (newChatErr) throw newChatErr;
      activeChat = newChat;
    } else {
      activeChat = activeChatData;
    }

    chatMetadata = activeChat.metadata || {};
    activeTopicKey = chatMetadata.activeTopicKey || 'general';
    branches = chatMetadata.branches || {};

    // 2. Interrupt Handling: Detect topic switches
    const topicAnalysis = (await analyzeTopics(content)) || { active_topics: [], intent_hints: [] };
    const topics = topicAnalysis.active_topics || [];
    let targetTopicKey = 'general';

    if (topics.includes('food')) {
      targetTopicKey = 'food';
    } else if (topics.includes('career') || topics.includes('job') || topics.includes('finances')) {
      targetTopicKey = 'career';
    } else if (topics.includes('study') || topics.includes('academic') || topics.includes('exam')) {
      targetTopicKey = 'study';
    }

    if (targetTopicKey !== activeTopicKey) {
      // Pause current topic branch in metadata
      branches[activeTopicKey] = {
        state: activeChat.state || 'Listening',
        paths: chatMetadata.possiblePaths || [],
        mascot: chatMetadata.lastMascot || 'munch'
      };

      // Create or resume target branch
      const resumedBranch = branches[targetTopicKey] || {
        state: 'Listening',
        paths: [],
        mascot: 'munch'
      };

      activeTopicKey = targetTopicKey;
      activeChat.state = resumedBranch.state;
      chatMetadata.possiblePaths = resumedBranch.paths;
      chatMetadata.lastMascot = resumedBranch.mascot;
    }

    // 3. Save User message to Database
    const { data: userMsgData } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender: 'user',
        content: content.trim()
      })
      .select()
      .single();
    userMessage = userMsgData;

    // 4. Fetch last 10 messages for context
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', activeChat.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const chatHistory = (recentMessages || []).reverse();
    const previousAssistantResponses = chatHistory
      .filter((message: any) => message.sender === 'mascot' || message.role === 'assistant')
      .map((message: any) => typeof message.content === 'string' ? message.content.trim() : '')
      .filter(Boolean);

    // Retrieve previous story state, progress, insights, memories, decisions, and personality from the last mascot message's nlu_metadata if present
    let previousStoryState: any = undefined;
    let previousStoryProgress: any = undefined;
    let previousStoryInsight: any = undefined;
    let previousMemoryState: any = undefined;
    let previousCognitiveDecision: any = undefined;
    let previousPersonalityDecision: any = undefined;
    if (chatHistory && chatHistory.length > 0) {
      const lastMascotMsg = [...chatHistory].reverse().find((m: any) => m.sender === 'mascot');
      if (lastMascotMsg && lastMascotMsg.nlu_metadata) {
        let metadata = lastMascotMsg.nlu_metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch {}
        }
        if (metadata) {
          if (metadata.storyState) {
            previousStoryState = metadata.storyState;
          }
          if (metadata.storyProgress) {
            previousStoryProgress = metadata.storyProgress;
          }
          if (metadata.storyInsight) {
            previousStoryInsight = metadata.storyInsight;
          }
          if (metadata.memoryState) {
            previousMemoryState = metadata.memoryState;
          }
          if (metadata.cognitiveDecision) {
            previousCognitiveDecision = metadata.cognitiveDecision;
          }
          if (metadata.personalityDecision) {
            previousPersonalityDecision = metadata.personalityDecision;
          }
        }
      }
    }

    if (previousStoryState) {
      previousStoryState.events = previousStoryState.events || [];
    }

    // 5. Build context package
    const contextBuilder = new MunchContextBuilder();
    const context = await contextBuilder.buildContext({
      user_id: user.id,
      user_input: content.trim(),
      options: (chatMetadata.possiblePaths || []).map((p: any) => p.text),
      topic_analysis: topicAnalysis
    });
    context.chatHistory = chatHistory;
    context.consecutiveReflectionCount = chatMetadata.consecutiveReflectionCount || 0;
    context.previousStoryState = previousStoryState;
    context.previousStoryProgress = previousStoryProgress;
    context.previousStoryInsight = previousStoryInsight;
    context.previousMemoryState = previousMemoryState;
    context.previousCognitiveDecision = previousCognitiveDecision;
    context.previousPersonalityDecision = previousPersonalityDecision;
    // Provide prior assistant responses to PromptBuilderEngine for the hard anti-repetition guard
    context.previousAssistantResponses = previousAssistantResponses;

    // 6. Initialize pipeline trace
    const initialTrace: CognitiveTrace = {
      state: activeChat.state || 'Listening',
      emotions: [],
      reflections: [],
      readinessScore: 0.0,
      readinessThreshold: 0.65,
      mascotCharacter: chatMetadata.lastMascot || 'munch',
      mascotExpression: 'idle',
      mascotReason: '',
      generatedPaths: chatMetadata.possiblePaths || [],
      confidence: 1.0,
      activeTopicKey,
      storyState: previousStoryState,
      storyProgress: previousStoryProgress,
      storyInsight: previousStoryInsight,
      memoryState: previousMemoryState,
      cognitiveDecision: previousCognitiveDecision,
      personalityDecision: previousPersonalityDecision
    };

    // 7. Run Modular Engines Plugin Pipeline
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
      new PersonalityEngine(),
      new ResponsePlanningEngine(),
      new ReflectionEngine(),
      new ContextAssemblyEngine(),
      new DecisionReadinessEngine(),
      new MascotSpecialistEngine(),
      new PromptBuilderEngine()
    ];

    let activePipeline = pipeline;
    let traceToUse = initialTrace;

    if (draftId) {
      const draftKey = `${user.id}:${draftId}`;
      const cached = SPECULATIVE_CACHE.get(draftKey);
      if (cached && cached.pipelineVersion === PIPELINE_VERSION) {
        const invalidatedEngines = resolveInvalidatedEngines(cached.draft, content);
        
        // In speculative cache hit, initialTrace is seeded with the cached speculative trace
        const cachedTrace = cached.cognitiveTrace;
        cachedTrace.generatedPaths = initialTrace.generatedPaths; // keep paths
        
        traceToUse = cachedTrace;
        activePipeline = pipeline.filter(engine => invalidatedEngines.has(engine.name));
      }
      SPECULATIVE_CACHE.delete(draftKey);
    }

    finalTrace = await runCognitivePipeline(activePipeline, traceToUse, context);

    // Lock mascot character to the session's primary mascot to maintain consistency
    const primaryMascot = chatMetadata.primaryMascot || chatMetadata.lastMascot || 'munch';
    finalTrace.mascotCharacter = primaryMascot;

    // 8. Call LLM Gateway & Validate Response in a Retry Loop
    const validator = new ResponseValidator();
    let gatewayResponse: any;
    let validationResult: any;
    let retryAttempt = 0;
    const maxRetries = 2;

    while (retryAttempt <= maxRetries) {
      if (retryAttempt > 0) {
        console.log(`[POST /api/chat] Validation failed. Re-running Prompt Builder Engine (attempt=${retryAttempt})...`);
        const builder = new PromptBuilderEngine();
        finalTrace = await builder.execute(finalTrace, context);
      }

      const voicePromise = generateMascotVoice(finalTrace, context);
      gatewayResponse = await withTimeout(voicePromise, 6000, 'Narrator voice generation timed out');

      const validatorInput = {
        gatewayResponse,
        promptPackage: finalTrace.promptPackage!,
        responsePlan: finalTrace.responsePlan,
        personalityDecision: finalTrace.personalityDecision,
        mascotDecision: finalTrace.mascotDecision,
        contextAssembly: finalTrace.contextAssembly,
        previousAssistantResponses
      };

      validationResult = validator.validate(validatorInput, retryAttempt);

      if (validationResult.passed) {
        break;
      }

      if (validationResult.validationScore < 80 && retryAttempt < maxRetries) {
        retryAttempt++;
        finalTrace.retryHints = validator.compileRetryHints(validationResult.issues);
      } else {
        break;
      }
    }

    if (!validationResult.passed && validationResult.issues.some((issue: any) =>
      issue.id === 'quality-repeat-assistant-response' || issue.id === 'quality-repeat-assistant-opening'
    )) {
      throw new Error('Unable to generate a non-repetitive response. Please try again.');
    }

    // Run ResponseExpressionEngine (the final presentation layer before delivery)
    const expressionEngine = new ResponseExpressionEngine();
    const mascot = finalTrace.mascotDecision;
    const personality = finalTrace.personalityDecision;

    const expressionProfile = {
      mascotId: mascot?.mascotId || 'munch',
      dominantTrait: personality?.dominantTrait || 'calm',
      communicationStyle: personality?.communicationStyle || 'balanced',
      energyLevel: personality?.energyLevel || 'medium',
      expressionIntensity: personality?.expressionIntensity || 'medium',
      humorAllowed: personality?.humorAllowed ?? false,
      useMetaphors: personality?.useMetaphors ?? false
    };

    const expressionResult = expressionEngine.execute({
      validatedResponse: gatewayResponse.text,
      profile: expressionProfile,
      responsePlan: finalTrace.responsePlan
    });

    const voiceMessageText = expressionResult.finalText;

    // 9. Save Mascot message to Database
    const { data: mascotMessage } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: activeChat.id,
        sender: 'mascot',
        content: voiceMessageText,
        mascot_character: finalTrace.mascotCharacter,
        mascot_expression: finalTrace.mascotExpression,
        nlu_metadata: {
          emotions: finalTrace.emotions,
          readinessScore: finalTrace.readinessScore,
          readinessThreshold: finalTrace.readinessThreshold,
          reflections: finalTrace.reflections,
          storyState: finalTrace.storyState,
          storyProgress: finalTrace.storyProgress,
          storyInsight: finalTrace.storyInsight,
          memoryState: finalTrace.memoryState,
          cognitiveDecision: finalTrace.cognitiveDecision,
          personalityDecision: finalTrace.personalityDecision,
          responsePlan: finalTrace.responsePlan,
          contextAssembly: finalTrace.contextAssembly,
          promptPackage: stripPromptContent(finalTrace.promptPackage),
          llmMetrics: gatewayResponse.metrics,
          validation: {
            passed: validationResult.passed,
            validationScore: validationResult.validationScore,
            highestSeverity: validationResult.highestSeverity,
            retryCount: validationResult.metrics.retryCount,
            durationMs: validationResult.metrics.durationMs,
            validatorVersion: validationResult.metrics.validatorVersion,
            rulesVersion: validationResult.metrics.rulesVersion,
            responseHash: validationResult.metrics.responseHash,
            issues: (!validationResult.passed || process.env.NODE_ENV === 'development') ? validationResult.issues : undefined
          },
          expression: {
            expressionVersion: expressionResult.metrics.expressionVersion,
            transformationsApplied: expressionResult.metrics.transformationsApplied,
            warnings: expressionResult.metrics.warnings
          }
        }
      })
      .select()
      .single();

    // 10. Update active chat in database
    chatMetadata.activeTopicKey = activeTopicKey;
    chatMetadata.possiblePaths = finalTrace.generatedPaths;
    chatMetadata.lastMascot = finalTrace.mascotCharacter;
    chatMetadata.branches = branches;
    chatMetadata.consecutiveReflectionCount = context.consecutiveReflectionCount || 0;

    await supabase
      .from('chats')
      .update({
        state: finalTrace.state,
        metadata: chatMetadata
      })
      .eq('id', activeChat.id);

    // 11. Periodic summary execution in background via after()
    const messageCount = (recentMessages || []).length;
    if (messageCount >= 20 && messageCount % 20 === 0) {
      after(async () => {
        try {
          const { data: allMessages } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('chat_id', activeChat.id)
            .order('created_at', { ascending: true });
          await generateConversationSummary(activeChat.id, user.id, allMessages || []);
        } catch (err) {
          console.error('[Summarizer] Background summary failed:', err);
        }
      });
    }

    // Opaque Request / Response Correlation Logging
    const requestId = gatewayResponse.requestId || crypto.randomUUID();
    console.log(`[API /api/chat] [${requestId}] User: ${user.id.slice(0, 8)}... Chat: ${activeChat.id} Provider: ${gatewayResponse.metrics?.providerId || 'unknown'} Model: ${gatewayResponse.metrics?.modelId || 'unknown'} ValidationPassed: ${validationResult.passed} Retries: ${retryAttempt}`);

    return jsonNoStore({
      message: mascotMessage,
      userMessage,
      state: finalTrace.state,
      mascotCharacter: finalTrace.mascotCharacter,
      mascotExpression: finalTrace.mascotExpression,
      activeTopicKey: finalTrace.activeTopicKey,
      readinessScore: finalTrace.readinessScore,
      readinessThreshold: finalTrace.readinessThreshold,
      reflections: finalTrace.reflections,
      possiblePaths: finalTrace.generatedPaths,
      storyState: finalTrace.storyState,
      storyProgress: finalTrace.storyProgress,
      storyInsight: finalTrace.storyInsight,
      memoryState: finalTrace.memoryState,
      cognitiveDecision: finalTrace.cognitiveDecision,
      personalityDecision: finalTrace.personalityDecision,
      responsePlan: finalTrace.responsePlan,
      contextAssembly: finalTrace.contextAssembly,
      promptPackage: stripPromptContent(finalTrace.promptPackage),
      llmMetrics: gatewayResponse.metrics,
      validation: {
        passed: validationResult.passed,
        validationScore: validationResult.validationScore,
        highestSeverity: validationResult.highestSeverity,
        retryCount: validationResult.metrics.retryCount,
        durationMs: validationResult.metrics.durationMs,
        validatorVersion: validationResult.metrics.validatorVersion,
        rulesVersion: validationResult.metrics.rulesVersion,
        responseHash: validationResult.metrics.responseHash,
        issues: (!validationResult.passed || process.env.NODE_ENV === 'development') ? validationResult.issues : undefined
      },
      expression: {
        expressionVersion: expressionResult.metrics.expressionVersion,
        transformationsApplied: expressionResult.metrics.transformationsApplied,
        warnings: expressionResult.metrics.warnings
      }
    });
  } catch (error: any) {
    console.error('[POST /api/chat] Critical error in chat lifecycle:', error);
    return jsonNoStore(
      { error: error.message || 'Critical server error in chat lifecycle.' },
      { status: 500 }
    );
  }
}
