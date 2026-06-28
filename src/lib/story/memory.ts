import { CognitiveEngine, CognitiveTrace, ContextPackage } from '../reflection/types';
import { ConsolidatedMemory, MemoryState, StoryState } from './types';

// Configurable Memory Rules
const MEMORY_RULES = {
  reinforcement: {
    strength: 0.15,
    stability: 0.20
  },
  decay: {
    normal: 0.05,
    core: 0.01
  },
  archiveThreshold: 0.20,
  corePromotion: {
    stability: 0.8,
    confidence: 0.8,
    reinforcementCount: 3
  },
  maxActiveMemories: 100
};

// Jaccard similarity of words longer than 3 characters
function getTitleSimilarity(t1: string, t2: string): number {
  const words1 = new Set(t1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(t2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export class MemoryConsolidationEngine implements CognitiveEngine {
  public name = 'Memory Consolidation Engine';

  public async execute(trace: CognitiveTrace, context: ContextPackage): Promise<CognitiveTrace> {
    const previousMemoryState = context.previousMemoryState as MemoryState | undefined;
    const previousStory = context.previousStoryState as StoryState | undefined;

    const memories: ConsolidatedMemory[] = previousMemoryState
      ? previousMemoryState.memories.map(m => ({ ...m }))
      : [];

    const activeArc = trace.storyState?.currentArc || 'General Exploration';
    const evidence: string[] = [];

    // 1. Conflict Resolution (Pivots)
    const isPivot = trace.storyProgress?.storyShift === true;
    if (isPivot && trace.storyProgress) {
      const reason = trace.storyProgress.storyShiftReason;
      
      // Archive existing conflicting memories in 'goal' or 'identity' categories
      for (const m of memories) {
        if (!m.archived) {
          if (reason === 'goal_change' && m.category === 'goal' && m.title !== activeArc) {
            m.archived = true;
            m.evidence.push(`Archived due to story pivot to "${activeArc}"`);
            evidence.push(`Archived conflicting goal memory: "${m.title}"`);
          }
          if (reason === 'identity_change' && m.category === 'identity') {
            // Archive old identities that don't match the new ones
            const currentSignals = trace.storyState?.identitySignals || [];
            const isMatched = currentSignals.some(sig => m.title.toLowerCase().includes(sig.toLowerCase()));
            if (!isMatched) {
              m.archived = true;
              m.evidence.push(`Archived due to identity pivot`);
              evidence.push(`Archived conflicting identity memory: "${m.title}"`);
            }
          }
        }
      }
    }

    // 2. Identify Candidates for Consolidation
    const candidates: Array<{ category: ConsolidatedMemory['category']; title: string; summary: string }> = [];

    // Active Goals
    if (trace.storyState) {
      for (const goal of trace.storyState.activeGoals) {
        candidates.push({
          category: 'goal',
          title: capitalize(goal),
          summary: `Currently working towards: ${goal}`
        });
      }
      
      // Identity Signals
      for (const identity of trace.storyState.identitySignals) {
        candidates.push({
          category: 'identity',
          title: `Identity: ${capitalize(identity)}`,
          summary: `User identifies as: ${identity}`
        });
      }

      // Challenges
      for (const challenge of trace.storyState.activeChallenges) {
        candidates.push({
          category: 'challenge',
          title: `Challenge: ${capitalize(challenge)}`,
          summary: `Facing challenge: ${challenge}`
        });
      }

      // Achievement / Milestones newly added in this turn
      const prevEvents = previousStory?.events || [];
      const currentEvents = trace.storyState.events || [];
      const newMilestones = currentEvents.filter(
        e => (e.type === 'milestone' || e.type === 'achievement') && !prevEvents.some(pe => pe.id === e.id)
      );

      for (const e of newMilestones) {
        candidates.push({
          category: 'achievement',
          title: e.title,
          summary: e.description
        });
      }
    }

    // 3. Process candidates (Merge, Reinforce, Reactivate)
    const reinforcedMemoryIds = new Set<string>();

    for (const candidate of candidates) {
      // Find matching memory (Literal match or Jaccard similarity)
      const matchIndex = memories.findIndex(
        m =>
          m.category === candidate.category &&
          (m.title.toLowerCase() === candidate.title.toLowerCase() ||
            getTitleSimilarity(m.title, candidate.title) >= 0.3)
      );

      if (matchIndex !== -1) {
        const m = memories[matchIndex];
        reinforcedMemoryIds.add(m.id);

        m.reinforcementCount += 1;
        m.lastReinforced = new Date().toISOString();
        m.strength = Math.min(m.strength + MEMORY_RULES.reinforcement.strength, 1.0);
        m.stability = Math.min(m.stability + MEMORY_RULES.reinforcement.stability, 1.0);
        
        // Reactivate if archived
        if (m.archived) {
          m.archived = false;
          m.strength = Math.max(m.strength, 0.5); // restore to reasonable strength
          m.evidence.push(`Reactivated via reinforcement count: ${m.reinforcementCount}`);
          evidence.push(`Reactivated archived memory: "${m.title}"`);
        }

        // Core Promotion Check
        if (
          !m.isCore &&
          m.stability >= MEMORY_RULES.corePromotion.stability &&
          m.confidence >= MEMORY_RULES.corePromotion.confidence &&
          m.reinforcementCount >= MEMORY_RULES.corePromotion.reinforcementCount
        ) {
          m.isCore = true;
          m.evidence.push(`Promoted to Core Memory at stability ${m.stability.toFixed(2)}`);
          evidence.push(`Promoted memory to Core: "${m.title}"`);
        }
      } else {
        // Create new memory
        const newMemory: ConsolidatedMemory = {
          id: `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          category: candidate.category,
          title: candidate.title,
          summary: candidate.summary,
          strength: 0.5,
          stability: 0.1,
          confidence: trace.confidence || 0.8,
          firstObserved: new Date().toISOString(),
          lastReinforced: new Date().toISOString(),
          reinforcementCount: 1,
          archived: false,
          evidence: [`First observed under arc "${activeArc}"`]
        };
        memories.push(newMemory);
        reinforcedMemoryIds.add(newMemory.id);
        evidence.push(`Consolidated new memory: "${newMemory.title}"`);
      }
    }

    // 4. Inactive Memories Decay
    for (const m of memories) {
      if (!m.archived && !reinforcedMemoryIds.has(m.id)) {
        const decayRate = m.isCore ? MEMORY_RULES.decay.core : MEMORY_RULES.decay.normal;
        m.strength = Math.max(0.0, m.strength - decayRate);

        if (m.strength < MEMORY_RULES.archiveThreshold) {
          m.archived = true;
          m.evidence.push(`Archived due to strength decaying below threshold.`);
          evidence.push(`Archived decaying memory: "${m.title}"`);
        }
      }
    }

    // 5. Enforce Max Active Memories (Limit to 100)
    let activeMemories = memories.filter(m => !m.archived);
    if (activeMemories.length > MEMORY_RULES.maxActiveMemories) {
      // Sort active memories by strength ascending
      activeMemories.sort((a, b) => a.strength - b.strength);
      const excessCount = activeMemories.length - MEMORY_RULES.maxActiveMemories;

      for (let i = 0; i < excessCount; i++) {
        const target = activeMemories[i];
        const idx = memories.findIndex(m => m.id === target.id);
        if (idx !== -1) {
          memories[idx].archived = true;
          memories[idx].evidence.push(`Archived due to active memories limit exceeding.`);
          evidence.push(`Archived memory due to limit cap: "${memories[idx].title}"`);
        }
      }
    }

    // 6. Return trace with memoryState
    trace.memoryState = {
      memories
    };

    return trace;
  }
}
