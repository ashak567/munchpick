# Munch: Gentle Decision Companion

Munch is a local-first, privacy-respecting cognitive assistant that helps users understand their thoughts, feelings, patterns, and progress over time. Instead of relying purely on large language models (LLMs) to formulate reasoning, Munch runs a deterministic, multi-stage cognitive pipeline locally to build a deep structural understanding of the conversation before narration.

---

## Cognitive Pipeline Architecture

```
                       User Input
                           │
                           ▼
                      NLU Engine
                           │
                           ▼
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  Emotion Layer                           Story Layer
  (State → Regulation → Dynamics)         (Engine → Events → Progress → Intelligence)
       └───────────────────┬───────────────────┘
                           ▼
              Memory Consolidation Engine
                           │
                           ▼
                 Cognitive Orchestrator
                           │
                           ▼
                   Personality Engine
                           │
                           ▼
                Response Planning Engine
                           │
                           ▼
                   Reflection Engine
                           │
                           ▼
               Decision Readiness Engine
                           │
                           ▼
               Mascot Specialist Engine
                           │
                           ▼
                    Prompt Builder
                           │
                           ▼
                     LLM Narrator
                           │
                           ▼
                    Mascot Dialogue
```

---

## Current Progress Checkpoint

### Phase 5
- [x] **Sprint 1**: Emotional State Engine
- [x] **Sprint 2**: Emotional Regulation & Dynamics
- [x] **Sprint 3**: Story Progress Engine
- [x] **Sprint 4**: Story Intelligence Engine
- [x] **Sprint 5**: Memory Consolidation Engine

### Phase 6
- [x] **Sprint 1**: Cognitive Orchestrator (Thinking Brain)
- [x] **Sprint 2**: Personality Engine (Identity & Expressive traits)
- [x] **Sprint 2 Refinements**: Expression Intensity & Response Constraints mapping
- [x] **Sprint 3**: Speculative Cognition Engine (Typing draft parallelization in RAM)
- [x] **Sprint 4**: Response Planning Engine (Pre-LLM structured blueprinting)

---

## Next Milestone

### Phase 6 Sprint 5 — Context Assembly Engine
This upcoming milestone will build a context packaging engine that gathers NLU observations, emotional history, story continuity, consolidated long-term memories, and the planning blueprint to prepare the final LLM prompt.

---

## Development

### Setup
Ensure node packages are installed:
```bash
npm install
```

### Run Tests
To run all 158 vitest unit and integration tests:
```bash
npx vitest run
```

### Production Build
To verify Next.js build:
```bash
npm run build
```
