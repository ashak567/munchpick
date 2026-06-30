# Layer 1 — Companion NLU Engine

The Companion NLU Engine acts as Layer 1 of the Munch Cognitive Architecture. 

---

## Purpose

The NLU Engine is designed to understand what the user is trying to communicate, prioritizing meaning over literal words. Humans communicate through language, context, implication, assumptions, incomplete thoughts, and personal history. The NLU Engine's goal is to parse and extract these semantic nuances.

### Critical Boundary

The NLU Engine does **NOT**:
* Detect emotions
* Detect intent
* Reason
* Make decisions
* Generate responses

Those responsibilities belong to future layers. The NLU Engine is strictly observational and probabilistic.

---

## Folder Structure

The module is housed under `src/lib/nlu/` and is structured as follows:

*   [`types.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/types.ts): Strongly-typed interfaces for context inputs, history, evolution, and all 12 responsibilities.
*   [`confidence.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/confidence.ts): Utility functions to normalize confidence scores (between 0.0 and 1.0) and handle evidence.
*   [`fallback.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/fallback.ts): A local, rule-based keyword and regex parser. It runs as a resilient fallback if Gemini is unconfigured or fails.
*   [`pipeline.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/pipeline.ts): The core LLM execution pipeline utilizing Gemini 3.1 Flash. It constructs context-aware prompts and validates structured JSON output.
*   [`resolver.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/resolver.ts): The post-processing engine applying evidence weighting, hierarchy, safeguards, evolution metrics, and curiosity trigger controls.
*   [`service.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/service.ts): The service wrapper (`NLUEngine`) which manages historical database loading, runs the pipeline, calls the resolver, and persists runs asynchronously to Supabase.

---

## Advanced Cognitive Resolver Rules

The [NLU Resolver](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/nlu/resolver.ts) processes raw observations using these 6 cognitive rules:

### 1. Evidence Weighting System
*   **Source Quality**: Tracks quality based on source type:
    *   Direct User Input: `1.0` (highest confidence priority).
    *   Recent Conversation turns: `0.8` (high priority).
    *   Profile HUPS Beliefs: `0.7` (medium priority).
    *   Memories: `0.6` (decayed priority).
*   **Evidence Boosting**: Programmatically boosts confidence (+0.12 to +0.15) if evidence for an observation is found across multiple independent sources.
*   **Contradiction Suppression**: Suppresses historical anxiety/fatigue signals (by multiplying confidence by `0.3`) when the user explicitly states they are currently calm/relaxed in the current message.

### 2. Context Hierarchy
Prioritizes current states: `Current Input (1.0) > Recent Conversation (0.8) > Profile (0.7) > Memory (0.5) > Relationship (0.5)`. Current direct user input takes precedence over older profile beliefs.

### 3. Meaning Evolution & 6. Meaning Stability
*   **History Loading**: Fetches the last 20 NLU observations (`dimension = 'nlu'`) for the user.
*   **Stability Boosting**: Boosts the confidence of topics or state signals that recurrently appear in past conversation turns.
*   **Drift Tracking**: Flags state signals or topics that represent new shifts/drift from history.
*   **State Persistence**: Logs observations back to Supabase (`user_observations` table with dimension `nlu`) asynchronously after analysis.

### 4. Hidden Meaning Safeguards
*   **Prevent Over-interpretation**: Capped confidence (maximum `0.7` for hidden meanings and `0.75` for ambiguities) to prevent over-interpretation of indirect cues.
*   **Preserve Uncertainty**: Retains competing interpretations to let future layers decide.
*   **Thresholding**: Programmatically filters out any observation with resolved confidence `< 0.3`.

### 5. Curiosity Trigger Controls
*   **Prioritization**: Sorts curiosity triggers by confidence in descending order.
*   **Low-Value Filtering**: Discards triggers with confidence `< 0.5`.
*   **Redundancy Pruning**: Prevents redundant questioning (e.g. prunes triggers related to options if options are already present, or related to family if family beliefs are already established).

---

---

## Cognitive Expansion Detections

The Companion NLU Engine includes 10 cognitive detections to extract deeper understanding from user inputs:

### 1. Perspective Detection (`perspectives`)
*   **Mindset Classes**: `growth`, `fixed`, or `neutral`.
*   **Agency Locus Types**: 
    *   `internal_locus`: User feels in control of their choices.
    *   `external_locus`: User feels constrained or forced by outer factors.
    *   `victim_agency`: User expresses feelings of helplessness or external blame.
    *   `agency_active`: User is actively executing and taking accountability.

### 2. Certainty Detection (`certainties`)
*   **Certainty Levels**: `absolute`, `high`, `hesitant`, or `undecided`.
*   **Key Doubts**: Tracks explicit or inferred reservations (e.g. `unclear individual preference`, `lack of clear selection criteria`).

### 3. Goal Signal Detection (`goals`)
*   **Timeframes**: `immediate`, `short_term`, or `long_term`.
*   **Goal Types**:
    *   `explicit`: Injected directly in statements (e.g. "I want to cook dinner").
    *   `implicit`: Derived from context or options (e.g. "Choose between options").

### 4. Obstacle Detection (`obstacles`)
*   **Obstacle Types**: `internal` (emotional/energy blockers), `external` (logistics), `interpersonal` (social dynamics), `financial` (budget constraints), `time` (deadlines), or `other`.

### 5. Stakeholder Detection (`stakeholders`)
*   **Stakeholder Mapping**: Identifies third parties affected by or influencing the decision (e.g. family, boss, partner) along with their relation/impact levels (`low`, `medium`, `high`).

### 6. Importance Detection (`importances`)
*   **Drivers**: Explores *why* the user is pursuing a decision. Supported drivers are:
    *   `value_alignment`: Goals rooted in growth, values, or purpose.
    *   `fear_of_missing_out`: FOMO and social inclusion worries.
    *   `social_pressure`: External demands or expectations.
    *   `urgency`: Impending deadlines or time efficiency constraints.
    *   `other`.

### 7. Relationship Reference Detection (`relationship_references`)
*   **Reference Types**: Categorizes the nature of relationship references: `support`, `conflict`, `pressure`, `seeking_approval`, or `neutral`.

### 8. Self-Reflection Detection (`reflections`)
*   **Reflection Levels**: `high`, `medium`, or `none`.
*   **Reflection Types**:
    *   `introspection`: User actively probes their reasons or behaviors.
    *   `justification`: User is justifying their state/decisions.
    *   `deflection`: User is avoiding self-probing or deflecting.

### 9. Emotional Readiness Signals (`readiness_signals`)
*   **Readiness States**:
    *   `ready_to_decide`: Ready to move forward with a selection.
    *   `needs_grounding`: Overwhelmed, panicked, or fatigued.
    *   `resistant`: Showing emotional friction or refusal.
    *   `open_to_exploration`: Open to looking at options and pathways.

### 10. Meaning Importance Scoring (`meanings` update)
*   Updates the `MeaningInterpretation` model to include `importance_score: number` (0.0 to 1.0) indicating how central a specific interpretation is to the user's primary situation.

---

## Orchestrator Integration

The NLU Engine is hooked into `MunchOrchestrator` via `NLUAgent` in [`agents.ts`](file:///c:/Users/ASUS/OneDrive/Documents/munchpick/src/lib/orchestrator/agents.ts). 

By setting `this.isSharedPipeline = false`, `NLUAgent` runs independently and calls the dedicated NLU Engine pipeline:
```typescript
import { nluEngine } from '../nlu/service';

export class NLUAgent extends BaseAgent {
  constructor() {
    super('NLU Agent', false);
  }

  override async analyze(context: ContextPackage): Promise<AgentObservation[]> {
    return nluEngine.analyze(context);
  }
}
```

---

## Verification and Testing

To run the unit tests:
```bash
npx vitest run src/lib/nlu/nlu.test.ts
npx vitest run src/lib/orchestrator/service.test.ts
```
