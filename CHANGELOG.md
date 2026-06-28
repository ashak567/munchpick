# Changelog

All notable changes to this project will be documented in this file.

## [v0.6.0] - 2026-06-29

### Added
- **Response Planning Engine (Phase 6 Sprint 4)**: Implemented a configuration-driven blueprint planner running post-personality and pre-reflection/LLM generation. It organizes responses into prioritized, required, or optional sections (`opening`, `acknowledgement`, `reflection`, `story_reference`, `memory_reference`, `guidance`, `question`, `closing`), determines ending styles, and handles reference exclusion.
- **Speculative Cognition Engine (Phase 6 Sprint 3)**: Introduced stateless speculative execution in RAM while the user drafts, supported by Jaccard token overlap metrics, prediction confidence gates, AbortController cancellations, and dependency-driven invalidation sets.
- **Personality Refinements (Phase 6 Sprint 2 Refinements)**: Exposed stable personality traits, expression intensity levels, and detailed response constraints (e.g. `avoidHumor`, `avoidLongReplies`) without overriding Orchestrator authority.
- **Personality Engine (Phase 6 Sprint 2)**: Added stable trait momentum smoothing, rules-based dynamics, and communications style overrides.
- **Cognitive Orchestrator (Phase 6 Sprint 1)**: Integrated a central brain that calculates and weights emotion, story, memory, and reflection prevention scores, resolving a dominant need and urgency level.
- **Memory Consolidation Engine (Phase 5 Sprint 5)**: Implemented consolidated memory storage under custom reinforcement and decay rules, similarity-based merging, and core promotion.
- **Story Intelligence Engine (Phase 5 Sprint 4)**: Introduced recurring patterns, unresolved narrative arcs, fears, and growth analysis.
- **Story Progress Engine (Phase 5 Sprint 3)**: Added continuity stages, stagnation detection, milestone bonuses, and narrative pivot analysis.

### Technical Achievements
- **Thinking → Planning → Expression Separation**: Backend cognition is now fully partitioned into Orchestrator/Personality (Thinking) → Response Planner (Planning) → Mascot Narrator/LLM (Expression).
- **158 Automated Tests Passing**: Robust test suites cover every engine module, integration route, and speculative caching behaviors.
- **Type Safety**: Passed full strict TypeScript compilation.
