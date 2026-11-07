/**
 * The presentation helpers.
 *
 * `contrastingTextColor` is the one that matters: a project can be given any
 * colour, and the label drawn on top of it has to stay readable. The rest are
 * small enough that the edges are the whole story -- empty input, one-word
 * names, malformed hex.
 */

import { describe, expect, it } from 'vitest'

import { cn, contrastingTextColor, initials, pluralize, withAlpha } from '@/lib/utils'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b')
  })

  it('lets the later Tailwind utility win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('keeps utilities that do not conflict', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })
})

describe('initials', () => {
  it('takes the first and last initials', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('Grace Brewster Hopper')).toBe('GH')
  })

  it('takes two letters from a single name', () => {
    expect(initials('Prince')).toBe('PR')
  })

  it('ignores surrounding and repeated whitespace', () => {
    expect(initials('  Ada   Lovelace  ')).toBe('AL')
  })

  it('falls back to a placeholder for an empty name', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })

  it('upper-cases whatever it is given', () => {
    expect(initials('ada lovelace')).toBe('AL')
  })
})

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'task')).toBe('1 task')
  })

  it('uses the plural for everything else', () => {
    expect(pluralize(0, 'task')).toBe('0 tasks')
    expect(pluralize(2, 'task')).toBe('2 tasks')
  })

  it('accepts an irregular plural', () => {
    expect(pluralize(2, 'person', 'people')).toBe('2 people')
    expect(pluralize(1, 'person', 'people')).toBe('1 person')
  })
})

describe('contrastingTextColor', () => {
  const dark = '#0f172a'
  const light = '#ffffff'

  it('puts dark text on a light background', () => {
    expect(contrastingTextColor('#ffffff')).toBe(dark)
    expect(contrastingTextColor('#fde047')).toBe(dark)
  })

  it('puts light text on a dark background', () => {
    expect(contrastingTextColor('#000000')).toBe(light)
    expect(contrastingTextColor('#1e3a8a')).toBe(light)
  })

  it('weights green far above blue, as relative luminance does', () => {
    // Pure green is the brightest primary to the eye; pure blue the dimmest.
    expect(contrastingTextColor('#00ff00')).toBe(dark)
    expect(contrastingTextColor('#0000ff')).toBe(light)
  })

  it('accepts a hex string with or without the leading hash', () => {
    expect(contrastingTextColor('ffffff')).toBe(dark)
  })

  it('falls back to white for anything that is not six hex digits', () => {
    expect(contrastingTextColor('#fff')).toBe(light)
    expect(contrastingTextColor('')).toBe(light)
    expect(contrastingTextColor('not a colour')).toBe(light)
  })
})

describe('withAlpha', () => {
  it('appends the alpha channel as two hex digits', () => {
    expect(withAlpha('#3b82f6', 1)).toBe('#3b82f6ff')
    expect(withAlpha('#3b82f6', 0)).toBe('#3b82f600')
  })

  it('pads a single digit', () => {
    expect(withAlpha('#3b82f6', 0.02)).toBe('#3b82f605')
  })

  it('clamps out-of-range alphas instead of producing invalid hex', () => {
    expect(withAlpha('#3b82f6', 5)).toBe('#3b82f6ff')
    expect(withAlpha('#3b82f6', -1)).toBe('#3b82f600')
  })

  it('returns the input unchanged when it is not six hex digits', () => {
    expect(withAlpha('#fff', 0.5)).toBe('#fff')
  })
})
