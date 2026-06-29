import { MascotCharacter, MascotExpression } from '@/components/Mascot';
import { DetectedEmotion, EmotionalState, EmotionalGuidance, EmotionalDynamics } from '../emotion/types';
import { StoryState, StoryProgress, StoryInsight, MemoryState } from '../story/types';

export type ContextCategory =
  | "system"
  | "emotion"
  | "story"
  | "memory"
  | "planning"
  | "reflection"
  | "personality"
  | "conversation";

export type ContextImportance = "critical" | "high" | "medium" | "low";

export interface ContextBlock {
  id: string;
  category: ContextCategory;
  priority: number;
  importance: ContextImportance;
  required: boolean;
  estimatedTokens: number;
  sourceIds: string[];
  content: Record<string, unknown>;
}

export interface AssemblyMetrics {
  totalBlocks: number;
  mergedBlocks: number;
  trimmedBlocks: number;
  skippedBlocks: number;
  estimatedTokens: number;
}

export interface ProviderHints {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
}

export interface ContextAssembly {
  blocks: ContextBlock[];
  totalEstimatedTokens: number;
  trimmedBlocks: string[];
  duplicateBlocksMerged: number;
  confidence: number;
  pipelineVersion: string;
  assemblyOrder: string[];
  isIncomplete: boolean;
  generationIntent: string;
  assemblyMetrics: AssemblyMetrics;
  providerHints: ProviderHints;
}

export type PromptSectionType =
  | "system"
  | "identity"
  | "personality"
  | "context"
  | "story"
  | "memory"
  | "conversation"
  | "instructions"
  | "response_plan";

export interface PromptSection {
  id: string;
  type: PromptSectionType;
  priority: number;
  required: boolean;
  content: string | Record<string, unknown>;
}

export interface PromptDirective {
  mustDo: string[];
  shouldDo: string[];
  avoid: string[];
}

export interface PromptStatistics {
  sections: number;
  estimatedTokens: number;
  checksum: string;
  compressionRatio: number;
}

export type RenderStrategy =
  | "conversation"
  | "comfort"
  | "guidance"
  | "reflection"
  | "celebration"
  | "problem_solving"
  | "creative"
  | "planning"
  | "education"
  | "brainstorm";

export interface PromptPackage {
  version: string;
  templateVersion: string;
  sections: PromptSection[];
  estimatedTokens: number;
  providerHints?: ProviderHints;
  checksum: string;
  isIncomplete?: boolean;
  directives: PromptDirective;
  statistics: PromptStatistics;
  renderStrategy: RenderStrategy;
}

export interface PromptBuildResult {
  promptPackage: PromptPackage;
  confidence: number;
}

export interface MascotDecision {
  mascotId: string;
  identity: string;
  behavior: string;
  speakingStyle: string;
  emotionalStyle: string;
  interactionStyle: string;
}

export type ConversationState =
  | 'Listening'
  | 'Understanding'
  | 'Exploring'
  | 'Clarifying'
  | 'Emerging Paths'
  | 'Choosing'
  | 'Reflection'
  | 'Learning'
  | 'Archived';

export interface PathCandidate {
  text: string;
  tags: string[];
}

export interface StructuredReflection {
  observation: string;
  reflection: string;
  confidence: number;
  type: 'energy' | 'emotion' | 'conflict' | 'path' | 'general';
}

export interface CognitiveTrace {
  state: ConversationState;
  emotions: string[];
  detectedEmotion?: DetectedEmotion;
  emotionalState?: EmotionalState;
  emotionalGuidance?: EmotionalGuidance;
  emotionDynamics?: EmotionalDynamics;
  storyState?: StoryState;
  storyProgress?: StoryProgress;
  storyInsight?: StoryInsight;
  memoryState?: MemoryState;
  cognitiveDecision?: CognitiveDecision;
  personalityDecision?: PersonalityDecision;
  responsePlan?: ResponsePlan;
  reflections: StructuredReflection[];
  readinessScore: number;
  readinessThreshold: number;
  mascotCharacter: MascotCharacter;
  mascotExpression: MascotExpression;
  mascotReason: string;
  generatedPaths: PathCandidate[];
  confidence: number;
  activeTopicKey: string;
  contextAssembly?: ContextAssembly;
  promptPackage?: PromptPackage;
  mascotDecision?: MascotDecision;
  retryHints?: any;
}

export interface CognitiveDecision {
  dominantNeed: 'listen' | 'comfort' | 'clarify' | 'guide' | 'motivate' | 'celebrate' | 'ground' | 'explore';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  emotionalPriority: number;
  storyPriority: number;
  memoryPriority: number;
  reflectionPriority: number;
  confidence: number;
  dominantReason: string;
  supportingReasons: string[];
  cognitiveLoad: number;
  responseDepth: 'short' | 'medium' | 'deep';
  askQuestion: boolean;
  acknowledgeEmotion: boolean;
  referenceMemory: boolean;
  referenceStory: boolean;
}

export interface PersonalityProfile {
  empathy: number;
  curiosity: number;
  playfulness: number;
  encouragement: number;
  calmness: number;
  directness: number;
  optimism: number;
  confidence: number;
}

export interface ResponseConstraints {
  avoidHumor: boolean;
  avoidLongReplies: boolean;
  avoidQuestions: boolean;
  avoidChallenges: boolean;
  preferExamples?: boolean;
  preferSteps?: boolean;
}

export interface PersonalityDecision {
  dominantTrait: "empathetic" | "curious" | "encouraging" | "calm" | "playful" | "direct" | "optimistic";
  communicationStyle: "gentle" | "balanced" | "direct";
  energyLevel: "low" | "medium" | "high";
  expressionIntensity: "low" | "medium" | "high";
  humorAllowed: boolean;
  useMetaphors: boolean;
  validateEmotion: boolean;
  challengeUser: boolean;
  confidence: number;
  stability: number;
  supportingTraits: string[];
  responseConstraints: ResponseConstraints;
  mascotId?: string;
}

export type ResponseSectionType =
  | 'opening'
  | 'acknowledgement'
  | 'reflection'
  | 'story_reference'
  | 'memory_reference'
  | 'guidance'
  | 'question'
  | 'closing';

export interface ResponseSection {
  type: ResponseSectionType;
  priority: number;
  required: boolean;
}

export type ResponseGoal =
  | 'comfort'
  | 'guide'
  | 'celebrate'
  | 'clarify'
  | 'encourage'
  | 'educate'
  | 'reflect';

export type EndingStyle =
  | 'warm'
  | 'neutral'
  | 'encouraging'
  | 'reflective';

export interface ResponsePlan {
  responseGoal: ResponseGoal;
  primaryTopic: string;
  secondaryTopics: string[];
  sections: ResponseSection[];
  requiredReferences: {
    story: boolean;
    memory: boolean;
    emotion: boolean;
  };
  forbiddenReferences: {
    memory: boolean;
    story: boolean;
    humor: boolean;
  };
  transitionHints: string[];
  maxQuestions: number;
  endingStyle: EndingStyle;
  confidence: number;
}

export interface ContextPackage {
  user_id: string;
  user_input: string;
  user_name?: string;
  user_nickname?: string;
  options: string[]; // legacy compatibility
  importance?: string;
  emotional_state?: string;
  current_context?: string;
  profile_beliefs: any[];
  relevant_memories: any[];
  decision_history: any[];
  recent_context?: {
    active_topics: string[];
    intent_hints: string[];
    summary_of_recent_interactions: string;
  };
  uncertainties?: any[];
  chatHistory?: any[];
  [key: string]: any;
}

export interface CognitiveEngine {
  name: string;
  execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace>;
}
