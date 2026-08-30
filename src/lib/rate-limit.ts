import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from './env';
import { jsonNoStore } from './api-headers';
import { NextResponse } from 'next/server';

export type RateLimitScope = 'chat' | 'speculative' | 'table' | 'decisions' | 'journal';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // timestamp in ms when window resets
}

// Scope configurations: [requests, window]
const SCOPE_CONFIGS: Record<RateLimitScope, { requests: number; window: `${number} m` | `${number} s` }> = {
  chat: { requests: 20, window: '1 m' },         // Generous for natural turns, stops flood loops
  speculative: { requests: 40, window: '1 m' },  // Debounced typing predictions
  table: { requests: 10, window: '1 m' },        // 1-3 mascot turns per call (cost-sensitive)
  decisions: { requests: 15, window: '1 m' },    // Decision analysis & reinforcement
  journal: { requests: 10, window: '1 m' }       // Journal reflection generations
};

// In-memory fallback stores for environments without Upstash Redis or when Redis is unreachable
const memoryStores: Map<RateLimitScope, Map<string, { count: number; resetAt: number }>> = new Map();

function checkMemoryRateLimit(
  scope: RateLimitScope,
  identifier: string
): RateLimitResult {
  if (!memoryStores.has(scope)) {
    memoryStores.set(scope, new Map());
  }

  const store = memoryStores.get(scope)!;
  const now = Date.now();
  const config = SCOPE_CONFIGS[scope];
  const windowMs = config.window.endsWith('m')
    ? parseInt(config.window) * 60 * 1000
    : parseInt(config.window) * 1000;

  const current = store.get(identifier);

  if (!current || now >= current.resetAt) {
    const nextReset = now + windowMs;
    store.set(identifier, { count: 1, resetAt: nextReset });
    return {
      success: true,
      limit: config.requests,
      remaining: config.requests - 1,
      reset: nextReset
    };
  }

  if (current.count >= config.requests) {
    return {
      success: false,
      limit: config.requests,
      remaining: 0,
      reset: current.resetAt
    };
  }

  current.count += 1;
  store.set(identifier, current);

  return {
    success: true,
    limit: config.requests,
    remaining: config.requests - current.count,
    reset: current.resetAt
  };
}

// Cached distributed Upstash Ratelimit instances
const ratelimitInstances: Map<RateLimitScope, Ratelimit> = new Map();

function getUpstashRatelimit(scope: RateLimitScope): Ratelimit | null {
  const url = serverEnv?.UPSTASH_REDIS_REST_URL;
  const token = serverEnv?.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || url === 'MOCK_URL') {
    return null;
  }

  if (ratelimitInstances.has(scope)) {
    return ratelimitInstances.get(scope)!;
  }

  try {
    const redis = new Redis({
      url,
      token
    });

    const config = SCOPE_CONFIGS[scope];
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: `munch:ratelimit:${scope}`,
      analytics: false
    });

    ratelimitInstances.set(scope, limiter);
    return limiter;
  } catch (err) {
    console.warn('[RateLimit] Failed to initialize Upstash Redis client, using memory fallback:', err);
    return null;
  }
}

/**
 * Check rate limit for a specific scope and identifier (strictly authenticated user.id).
 * Executes BEFORE any expensive LLM operations.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = getUpstashRatelimit(scope);

  if (limiter) {
    try {
      const res = await limiter.limit(identifier);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset
      };
    } catch (err) {
      console.warn(`[RateLimit] Redis call failed for scope ${scope}, using local memory fallback:`, err);
      return checkMemoryRateLimit(scope, identifier);
    }
  }

  return checkMemoryRateLimit(scope, identifier);
}

/**
 * Generates standard 429 Too Many Requests response with Retry-After and rate limit headers.
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  const now = Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - now) / 1000));

  return jsonNoStore(
    {
      error: 'Too many requests. Please slow down and try again shortly.',
      retryAfter: retryAfterSeconds
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
        'X-RateLimit-Reset': String(result.reset)
      }
    }
  );
}
