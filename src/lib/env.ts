import * as z from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Shared / Client-side environment variables (NEXT_PUBLIC_*)
// These are inlined at build time and available on both server and client.
// ─────────────────────────────────────────────────────────────────────────────

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty'),
})

// ─────────────────────────────────────────────────────────────────────────────
// Server-only environment variables
// These are only available in server-side code (API routes, server actions).
// ─────────────────────────────────────────────────────────────────────────────

const serverEnvSchema = clientEnvSchema.extend({
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_REASONING_MODEL: z.string().optional(),
  GEMINI_AUXILIARY_MODEL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ANTHROPIC_REASONING_MODEL: z.string().optional(),
  ANTHROPIC_AUXILIARY_MODEL: z.string().optional(),
  LLM_DEFAULT_PROVIDER: z.string().optional(),
  LLM_FALLBACK_PROVIDERS: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatZodErrors(errors: z.core.$ZodIssue[]): string {
  return errors
    .map((e) => `  ✗ ${e.path.join('.')}: ${e.message}`)
    .join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Client env — eagerly validated at import time.
// Fails the build if NEXT_PUBLIC_* variables are missing.
// ─────────────────────────────────────────────────────────────────────────────

function getClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  if (!parsed.success) {
    const message = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  ❌  Missing required environment variables                 ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      formatZodErrors(parsed.error.issues),
      '',
      'Add these variables to your .env.local file or Vercel project settings.',
      '',
    ].join('\n')

    throw new Error(message)
  }

  return parsed.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Server env — eagerly validated at import time on the server.
// Fails the build / startup if any server variable is missing.
// ─────────────────────────────────────────────────────────────────────────────

function getServerEnv() {
  // Guard: this must only run on the server
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv must not be imported in client-side code. ' +
      'Use clientEnv instead.'
    )
  }

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_REASONING_MODEL: process.env.GEMINI_REASONING_MODEL,
    GEMINI_AUXILIARY_MODEL: process.env.GEMINI_AUXILIARY_MODEL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ANTHROPIC_REASONING_MODEL: process.env.ANTHROPIC_REASONING_MODEL,
    ANTHROPIC_AUXILIARY_MODEL: process.env.ANTHROPIC_AUXILIARY_MODEL,
    LLM_DEFAULT_PROVIDER: process.env.LLM_DEFAULT_PROVIDER,
    LLM_FALLBACK_PROVIDERS: process.env.LLM_FALLBACK_PROVIDERS,
  })

  if (!parsed.success) {
    const message = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  ❌  Missing required server environment variables          ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      formatZodErrors(parsed.error.issues),
      '',
      'Add these variables to your .env.local file or Vercel project settings.',
      '',
    ].join('\n')

    throw new Error(message)
  }

  return parsed.data
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported validated configs
// ─────────────────────────────────────────────────────────────────────────────

/** Validated client-side environment (safe to use in browser and server). */
export const clientEnv = getClientEnv()

/** Validated server-side environment (throws if imported from the browser). */
export const serverEnv = typeof window === 'undefined' ? getServerEnv() : null!

// Re-export types
export type ClientEnv = z.infer<typeof clientEnvSchema>
export type ServerEnv = z.infer<typeof serverEnvSchema>
