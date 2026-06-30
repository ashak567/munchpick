import { createClient } from '@/utils/supabase/server';
import { getProfile } from '../hup/service';
import { HUPSBelief } from '../hup/types';
import { UserMemory } from '../memory/types';
import { TopicAnalysis, ContextPackage, UncertaintySignal } from './types';
import { MunchOrchestrator, resolveConflicts } from '../orchestrator/service';
import { runSharedPipeline } from '../orchestrator/agents';
import { AgentObservation, ReasoningPackage } from '../orchestrator/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { serverEnv } from '@/lib/env';

const genAI = new GoogleGenerativeAI(serverEnv.GEMINI_API_KEY || 'MOCK_KEY');

export function getFallbackTopicAnalysis(userInput: string, currentContext = ''): TopicAnalysis {
  const combined = `${userInput} ${currentContext}`.toLowerCase();
  const topics: string[] = [];
  const hints: string[] = [];

  if (/exam|study|school|class|learn|homework|test/i.test(combined)) {
    topics.push('academic', 'exam', 'study');
    hints.push('stressed about performance', 'needs focus');
  }
  if (/stress|anxious|anxiety|worry|overwhelmed|panic/i.test(combined)) {
    topics.push('stress', 'anxiety', 'mental_health');
    hints.push('feeling overwhelmed', 'seeking calm');
  }
  if (/eat|food|dinner|lunch|breakfast|pizza|sushi|cook|restaurant/i.test(combined)) {
    topics.push('food', 'eating', 'comfort_food');
    hints.push('hunger', 'casual decision');
  }
  if (/movie|game|play|netflix|show|watch|book|read/i.test(combined)) {
    topics.push('entertainment', 'leisure', 'relaxation');
    hints.push('seeking distraction', 'unwinding');
  }
  if (/tired|sleep|exhausted|cozy|bed/i.test(combined)) {
    topics.push('sleep', 'fatigue', 'coziness');
    hints.push('low energy', 'needs comfort');
  }

  // Extract individual words of length > 4 as fallback keywords
  const words = combined.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4);
  topics.push(...words.slice(0, 3));

  return {
    active_topics: Array.from(new Set(topics)),
    intent_hints: hints
  };
}

export async function analyzeTopics(userInput: string, currentContext = ''): Promise<TopicAnalysis> {
  if (!serverEnv.GEMINI_API_KEY) {
    return getFallbackTopicAnalysis(userInput, currentContext);
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
Analyze the following user input and optional current context to extract active topics, concepts, and intent hints.
Munch is a decision companion, so focus on topics related to activities, food, emotions, habits, decision fatigue, or routines.

User Input: "${userInput}"
Current Context: "${currentContext}"

Output JSON schema:
{
  "active_topics": ["topic1", "topic2", ...], // lowercase keywords representing active topics or concepts
  "intent_hints": ["hint1", "hint2", ...] // brief notes about user intent or feelings (e.g. "seeking comfort", "stressed about school")
}
`;

  try {
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const parsed = JSON.parse(text);
    return {
      active_topics: parsed.active_topics || [],
      intent_hints: parsed.intent_hints || []
    };
  } catch (error) {
    console.error('Topic analysis failed, using fallback:', error);
    return getFallbackTopicAnalysis(userInput, currentContext);
  }
}

export function calculateTopicMatchScore(text: string, activeTopics: string[]): number {
  if (!text || activeTopics.length === 0) return 0;
  const normalizedText = text.toLowerCase();
  let matchCount = 0;
  for (const topic of activeTopics) {
    if (normalizedText.includes(topic.toLowerCase())) {
      matchCount++;
    }
  }
  return matchCount > 0 ? 1.0 + (matchCount - 1) * 0.2 : 0;
}

export function calculateRecencyWeight(dateString?: string, lambda = 0.05): number {
  if (!dateString) return 1.0;
  const ageInMs = Date.now() - new Date(dateString).getTime();
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
  return Math.exp(-lambda * Math.max(0, ageInDays));
}

export function getBeliefLastUpdatedAt(belief: any): string | undefined {
  if (belief.evidence_refs && belief.evidence_refs.length > 0) {
    const timestamps = belief.evidence_refs
      .map((ref: any) => ref.timestamp)
      .filter(Boolean)
      .map((ts: any) => new Date(ts).getTime());
    if (timestamps.length > 0) {
      return new Date(Math.max(...timestamps)).toISOString();
    }
  }
  return belief.updated_at;
}

export class MunchContextBuilder {
  public async buildContext(params: {
    user_id: string;
    user_input: string;
    options: string[];
    importance?: string;
    emotional_state?: string;
    current_context?: string;
  }): Promise<ContextPackage> {
    const supabase = await createClient();

    // 1. Topic Analysis
    const analysis = await analyzeTopics(params.user_input, params.current_context);
    const activeTopics = analysis.active_topics;

    // 2. Fetch beliefs (HUPS)
    const beliefsRaw = await getProfile(params.user_id).catch(() => [] as any[]);
    const beliefs = Array.isArray(beliefsRaw) ? beliefsRaw : [];

    // 3. Fetch memories
    const { data: memoriesRaw } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', params.user_id);
    const memories: UserMemory[] = (memoriesRaw || []) as UserMemory[];

    // 4. Fetch recent decisions and feedback
    const { data: recentDecisions } = await supabase
      .from('decisions')
      .select('id, selected_option, category, mascot, importance, created_at')
      .eq('user_id', params.user_id)
      .order('created_at', { ascending: false })
      .limit(10);
    const decisions = recentDecisions || [];

    const { data: recentFeedback } = await supabase
      .from('feedback')
      .select('decision_id, rating')
      .in('decision_id', decisions.map(d => d.id));
    const feedbackList = recentFeedback || [];
    const feedbackMap = new Map<string, string>();
    feedbackList.forEach(fb => feedbackMap.set(fb.decision_id, fb.rating));

    // 5. Relevance Ranking & Recency Model
    // A. Score HUPS beliefs
    const scoredBeliefs = beliefs.map(belief => {
      const matchScore = calculateTopicMatchScore(`${belief.key} ${JSON.stringify(belief.value)}`, activeTopics);
      const lastUpdated = getBeliefLastUpdatedAt(belief);
      const recencyWeight = calculateRecencyWeight(lastUpdated, 0.05);
      const confidenceScale = belief.confidence;
      const score = (0.2 + matchScore) * recencyWeight * confidenceScale;
      return { belief: belief as HUPSBelief, score };
    });

    // B. Score Memories
    const scoredMemories = memories.map(memory => {
      const matchScore = calculateTopicMatchScore(memory.summary, activeTopics);
      const recencyWeight = calculateRecencyWeight(memory.last_referenced_at || memory.created_at, 0.05);
      const confidenceScale = memory.confidence * memory.importance;
      const score = (0.2 + matchScore) * recencyWeight * confidenceScale;
      return { memory, score };
    });

    // C. Score Recent Decisions
    const scoredDecisions = decisions.map(decision => {
      const matchScore = calculateTopicMatchScore(`${decision.selected_option} ${decision.category}`, activeTopics);
      const recencyWeight = calculateRecencyWeight(decision.created_at, 0.05);
      const score = (0.2 + matchScore) * recencyWeight;
      return { decision, score };
    });

    // 6. Partition HUPS Beliefs into Profile Signals, Relationship Signals, and Uncertainties
    const profileSignalsRaw: { belief: HUPSBelief; score: number }[] = [];
    const relationshipSignalsRaw: { belief: HUPSBelief; score: number }[] = [];
    const uncertaintySignals: UncertaintySignal[] = [];

    scoredBeliefs.forEach(item => {
      // Map low confidence beliefs (< 0.5) to uncertainties
      if (item.belief.confidence < 0.5) {
        uncertaintySignals.push({
          key: item.belief.key,
          confidence: item.belief.confidence,
          description: `Low confidence belief about ${item.belief.key} (${JSON.stringify(item.belief.value)}).`
        });
      } else if (item.belief.dimension === 'uncertainty') {
        uncertaintySignals.push({
          key: item.belief.key,
          confidence: item.belief.confidence,
          description: `Uncertainty signal: ${JSON.stringify(item.belief.value)}.`
        });
      } else if (item.belief.dimension === 'relationship') {
        relationshipSignalsRaw.push(item);
      } else {
        profileSignalsRaw.push(item);
      }
    });

    // Sort and compress elements
    const selectedProfileSignals = profileSignalsRaw
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.belief);

    const selectedRelationshipSignals = relationshipSignalsRaw
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.belief);

    const selectedMemories = scoredMemories
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.memory);

    const selectedDecisions = scoredDecisions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => {
        const rating = feedbackMap.get(item.decision.id) || null;
        return {
          ...item.decision,
          rating
        };
      });

    // Fetch user name and active nickname
    const { data: userRecord } = await supabase
      .from('users')
      .select('name')
      .eq('id', params.user_id)
      .single();
    const userName = userRecord?.name || 'friend';

    const { data: activeNick } = await supabase
      .from('nickname_affinity')
      .select('nickname')
      .eq('user_id', params.user_id)
      .eq('is_active', true)
      .limit(1);
    const userNickname = activeNick && activeNick.length > 0 ? activeNick[0].nickname : userName;

    // Generate recent interactions summary (context compression)
    const summaryLines = selectedDecisions.map(d => 
      `- Chose "${d.selected_option}" in ${d.category} (Rating: ${d.rating || 'none'})`
    );
    const summary_of_recent_interactions = summaryLines.length > 0 
      ? `Recent choices:\n${summaryLines.join('\n')}` 
      : 'No recent decisions recorded.';

    return {
      user_id: params.user_id,
      user_input: params.user_input,
      user_name: userName,
      user_nickname: userNickname,
      options: params.options,
      importance: params.importance,
      emotional_state: params.emotional_state,
      current_context: params.current_context,

      // Layer 3 compatibility
      profile_beliefs: selectedProfileSignals,
      relevant_memories: selectedMemories,
      decision_history: selectedDecisions,

      // Layer 4 refined attention signals
      profile_signals: selectedProfileSignals,
      relationship_signals: selectedRelationshipSignals,
      relevant_decisions: selectedDecisions,
      recent_context: {
        active_topics: activeTopics,
        intent_hints: analysis.intent_hints,
        summary_of_recent_interactions
      },
      uncertainties: uncertaintySignals
    };
  }

  public async buildContextAndOrchestrate(params: {
    user_id: string;
    user_input: string;
    options: string[];
    importance?: string;
    emotional_state?: string;
    current_context?: string;
  }): Promise<ReasoningPackage> {
    // 1. Build refined context package
    const context = await this.buildContext(params);

    // 2. Retrieve registered agents from orchestrator
    const orchestrator = new MunchOrchestrator();
    const agents = orchestrator.getAgents();

    const sharedPipelineAgents = agents.filter(
      a => (a as any).isSharedPipeline === true
    );
    const independentAgents = agents.filter(
      a => (a as any).isSharedPipeline !== true
    );

    const observations: AgentObservation[] = [];

    // 3. Execute agents using compiled Context Package
    if (sharedPipelineAgents.length > 0) {
      try {
        const sharedObs = await runSharedPipeline(context as any, sharedPipelineAgents);
        observations.push(...sharedObs);
      } catch (err) {
        console.error('Shared pipeline error in Context Builder orchestration:', err);
      }
    }

    if (independentAgents.length > 0) {
      const independentPromises = independentAgents.map(async agent => {
        try {
          const obs = await agent.analyze(context as any);
          return obs;
        } catch (err) {
          console.error(`Independent agent ${agent.name} failed in Context Builder:`, err);
          return [];
        }
      });
      const results = await Promise.all(independentPromises);
      for (const res of results) {
        observations.push(...res);
      }
    }

    // 4. Resolve conflicts
    const { conflicts, uncertainties } = resolveConflicts(observations);

    // 5. Compile and return reasoning package
    return {
      context: context as any,
      observations,
      conflicts,
      uncertainties
    };
  }
}
