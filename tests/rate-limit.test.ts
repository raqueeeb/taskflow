/**
 * The fixed-window limiter in front of the auth endpoints.
 *
 * It is the only thing standing between a sign-in form and unlimited password
 * guesses on a single instance, so the boundary is worth pinning down: the
 * limit allows exactly `limit` attempts, rejects the next one, and forgets
 * everything once the window has passed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RateLimitError } from '@/lib/errors'
import { checkRateLimit, clientKey, resetRateLimits } from '@/lib/rate-limit'

const options = { limit: 3, windowMs: 60_000 }

function request(headers: Record<string, string>): Request {
  return new Request('https://example.test/login', { headers })
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetRateLimits()
  })

  it('allows exactly the configured number of attempts', () => {
    for (let attempt = 1; attempt <= options.limit; attempt += 1) {
      expect(() => checkRateLimit('a', options)).not.toThrow()
    }
    expect(() => checkRateLimit('a', options)).toThrow(RateLimitError)
  })

  it('keeps rejecting once the window is spent', () => {
    for (let attempt = 0; attempt < options.limit + 2; attempt += 1) {
      try {
        checkRateLimit('a', options)
      } catch {
        // counted below
      }
    }
    expect(() => checkRateLimit('a', options)).toThrow(RateLimitError)
  })

  it('counts each key separately', () => {
    for (let attempt = 0; attempt < options.limit; attempt += 1) {
      checkRateLimit('a', options)
    }
    expect(() => checkRateLimit('a', options)).toThrow(RateLimitError)
    // A different client is unaffected by the first one's spending.
    expect(() => checkRateLimit('b', options)).not.toThrow()
  })

  it('forgets the window once it has elapsed', () => {
    for (let attempt = 0; attempt < options.limit; attempt += 1) {
      checkRateLimit('a', options)
    }
    expect(() => checkRateLimit('a', options)).toThrow(RateLimitError)

    vi.advanceTimersByTime(options.windowMs + 1)
    expect(() => checkRateLimit('a', options)).not.toThrow()
  })

  it('does not reset part way through a window', () => {
    checkRateLimit('a', options)
    vi.advanceTimersByTime(options.windowMs - 1)
    checkRateLimit('a', options)
    checkRateLimit('a', options)
    expect(() => checkRateLimit('a', options)).toThrow(RateLimitError)
  })

  it('says how long is left, in whole seconds', () => {
    for (let attempt = 0; attempt < options.limit; attempt += 1) {
      checkRateLimit('a', options)
    }
    vi.advanceTimersByTime(30_000)
    expect(() => checkRateLimit('a', options)).toThrow(/Try again in 30 seconds/)
  })

  it('uses the singular for the last second', () => {
    for (let attempt = 0; attempt < options.limit; attempt += 1) {
      checkRateLimit('a', options)
    }
    vi.advanceTimersByTime(options.windowMs - 1000)
    expect(() => checkRateLimit('a', options)).toThrow(/Try again in 1 second\./)
  })

  it('sweeps expired buckets rather than growing without bound', () => {
    for (let i = 0; i < 500; i += 1) {
      checkRateLimit(`key-${i}`, { limit: 1, windowMs: 1_000 })
    }
    // Past every window, and past the sweep interval.
    vi.advanceTimersByTime(61_000)
    // The next call triggers the sweep; the old keys must be gone, which
    // shows as a fresh allowance rather than an immediate rejection.
    expect(() => checkRateLimit('key-0', { limit: 1, windowMs: 1_000 })).not.toThrow()
  })
})

describe('clientKey', () => {
  it('prefers the first address in x-forwarded-for', () => {
    const key = clientKey(request({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' }), 'login')
    expect(key).toBe('login:203.0.113.5')
  })

  it('trims whitespace around the forwarded address', () => {
    expect(clientKey(request({ 'x-forwarded-for': '  203.0.113.5  ' }), 'login')).toBe('login:203.0.113.5')
  })

  it('falls back through the other proxy headers in order', () => {
    expect(clientKey(request({ 'x-real-ip': '198.51.100.7' }), 'login')).toBe('login:198.51.100.7')
    expect(clientKey(request({ 'cf-connecting-ip': '198.51.100.9' }), 'login')).toBe('login:198.51.100.9')
  })

  it('uses a shared bucket when no address is available', () => {
    expect(clientKey(request({}), 'login')).toBe('login:unknown')
  })

  it('separates scopes so one endpoint cannot exhaust another', () => {
    const headers = { 'x-forwarded-for': '203.0.113.5' }
    expect(clientKey(request(headers), 'login')).not.toBe(clientKey(request(headers), 'signup'))
  })
})
