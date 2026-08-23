# Feature Specification: Munch Companion Core

**Feature Branch**: `munch-companion-core`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Set up Spec Kit and create Munch Companion Core specification defining What Munch is, conversational turn, user message priority, memory retrieval, reflection appropriateness, response planning, LLM gateway, failure handling, failure rules, mascot consistency, conversation continuity, and acceptance criteria."

---

## What is Munch?

Munch is a local-first, privacy-respecting cognitive assistant designed to help users understand their thoughts, feelings, patterns, and progress. Instead of relying solely on raw LLM prompts to formulate reasoning, Munch executes a deterministic, multi-stage cognitive pipeline locally. This builds a deep structural understanding of the conversation before using the LLM strictly as a narration layer to generate warm, empathetic dialogue.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Conversational Turn Execution (Priority: P1)

As a Munch user, I want the system to process my message through a deterministic pipeline and return a mascot-voiced response so that the cognitive reasoning is structured, personalized, and accurate.

**Why this priority**: Core value proposition of Munch. Without executing a structured pipeline and generating a validated response, the app is just a generic chatbot wrapper.

**Independent Test**: Send a user message and verify that:
1. The 19 cognitive engines execute in sequence.
2. A structured PromptPackage is compiled.
3. Gemini narrates the response according to directives.
4. The output is validated (score >= 80) and saved in the DB with metadata.

**Acceptance Scenarios**:
1. **Given** a user is logged in, **When** they send "I am stressed about my exams", **Then** the system returns a response that references their anxiety, validates their feelings, and updates the DB with NLU metadata.
2. **Given** a response fails formatting or safety validation, **When** the validator detects issues, **Then** it compiles retry hints and triggers a retry loop (up to 2 times).

---

### User Story 2 - Mascot/Session Consistency & Continuity (Priority: P2)

As a Munch user, I want the mascot's voice and character identity to remain consistent throughout a session, even when changing topics, so that I experience a coherent relationship with my companion.

**Why this priority**: Consistency builds trust. Swapping mascot traits or having mismatches between what the LLM renders and what the UI/DB records ruins the companionship experience.

**Independent Test**: Start a session with "Pandy" and verify that all prompts, generated dialogue, and database entries consistently use Pandy's profile, even if topic switching triggers alternate interest branches.

**Acceptance Scenarios**:
1. **Given** a session's primary mascot is `pandy`, **When** the user sends a message, **Then** the PromptBuilder uses Pandy's identity profile, and the saved message has `mascot_character` set to `pandy`.
2. **Given** the user shifts from a general conversation to a food decision, **When** the topic branch is paused/resumed, **Then** the system preserves the previous branch state and paths in the metadata.

---

### User Story 3 - Robust Technical Failure Visibility (Priority: P2)

As a developer/operator of Munch, I want technical failures to fail fast and loudly, so that errors are not masked as normal conversational dialogue.

**Why this priority**: Masking technical failures makes it impossible to monitor health, debug API keys, or diagnose database issues, leading to a silent failure state.

**Independent Test**: Mock a Gemini API key failure or database connection failure and verify that the API returns a `500 Server Error` response rather than a mock conversational message.

**Acceptance Scenarios**:
1. **Given** a network failure or LLM authentication error, **When** the request reaches the LLMGateway, **Then** it throws a `GatewayError` and does not convert the error into mock text.
2. **Given** a critical exception occurs during the chat route lifecycle, **When** the handler catches the exception, **Then** it returns an HTTP `500` status with error details rather than returning a `200 OK` JSON containing fallback conversational dialogue.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Munch Definition)**: Munch MUST run a deterministic, multi-stage cognitive pipeline locally (separating cognitive reasoning from verbal narration).
- **FR-002 (Valid Conversational Turn)**: A valid conversational turn MUST execute the following sequence:
  1. NLU observations resolution.
  2. Emotion state/regulation/dynamics processing.
  3. Story continuity/intelligence arc matching.
  4. Memory consolidation & retrieval.
  5. Cognitive Orchestrator weights/urgency mapping.
  6. Personality trait and response constraint mapping.
  7. Pre-LLM structured response planning.
  8. Reflection generation.
  9. Context Assembly normalising and token budgeting.
  10. Decision Readiness scoring.
  11. Mascot character/expression specialisation.
  12. PromptPackage compilation.
  13. LLM Gateway voice narration.
  14. Output validation and expression filtering.
  15. DB persistence.
- **FR-003 (User Message Priority)**: The PromptBuilder MUST instruct the LLM to focus primarily on the user's most recent message, preventing repetitive loops or repeating identical openings.
- **FR-004 (Memory Retrieval)**: Memories MUST be retrieved from the database using decay-adjusted scoring and matched contextually using a semantic query filter.
- **FR-005 (Reflection Appropriateness)**: Structured reflections MUST be generated based on active emotions, ambiguities, conflicts, story continuity, and memory. Reflections MUST be capped at a maximum of 3 unique items.
- **FR-006 (Response Planning)**: ResponsePlanningEngine MUST generate a plan detailing response goal, primary topic, secondary topics, ending style, and question limit prior to narration.
- **FR-007 (Voice Narration)**: The LLM MUST act strictly as a narrator translating structured reflections/directives, and MUST NOT create new reasoning or options.
- **FR-008 (LLM Failure Handling)**: The LLMGateway MUST enforce retry logic (3 times) and timeout limits (5s), and TRIP the circuit breaker (30s cooldown) upon 3 consecutive failures.
- **FR-009 (Technical Failure Rule)**: Technical failures (like invalid API keys, connection timeouts, or database exceptions) MUST NOT be converted into a normal conversational fallback. The server MUST return a non-200 HTTP status code.
- **FR-010 (Mascot Consistency)**: The mascot character packaged in PromptBuilder MUST match the mascot saved in DB and returned in the API response.
- **FR-011 (Conversation Continuity)**: The system MUST track topic branches (general, food, career, study) to pause/resume states and paths when users interrupt.
- **FR-012 (Acceptance Criteria)**: A turn is successful if the NLU is parsed, cognitive load is solved, prompt package checksum passes, gateway resolves successfully, validation score is >= 80, and DB writes succeed.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A conversational turn completes successfully within the 8000ms global pipeline timeout.
- **SC-002**: PromptPackage validation checksum matches calculated value on every request.
- **SC-003**: The ResponseValidator executes 7 plugins and yields a validation score >= 80 on all successful turns.
- **SC-004**: Mascot character IDs in `PromptPackage` match the final database record.
- **SC-005**: Database exceptions or API failures result in `500 Server Error` instead of `200 OK` conversational output.

---

## Assumptions

- **ASM-001**: The developer has configured `GEMINI_API_KEY` correctly in their local environment.
- **ASM-002**: Supabase is initialized and tables (`chats`, `chat_messages`, `user_memories`, etc.) exist with proper RLS policies.
- **ASM-003**: The client is able to parse standard HTTP status errors (like `500`) to display appropriate system error notifications.
