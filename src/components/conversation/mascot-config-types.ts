/**
 * mascot-config-types.ts
 *
 * Shared type re-exports used by both mascot-config.ts and conversation-config.ts.
 * This avoids circular imports when conversation-config.ts needs AttentionTarget.
 */

export type AttentionTarget = 'user' | 'message' | 'composer' | 'thinking' | 'nothing';
