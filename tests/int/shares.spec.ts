/**
 * Unit tests for the pure share-of-rows logic in src/lib/shares.ts.
 *
 * The header bar and the statistics card both render from this one function,
 * so its invariants are what keep the two views consistent.
 */
import { describe, it, expect } from 'vitest'
import { computeShares } from '@/lib/shares'
import type { Column, DataRow } from '@/lib/types'

const pi: Column = { key: 'pi', label: 'Principle Investigator', type: 'text' }

const row = (pi: string | null): DataRow => ({
  _id: 1,
  _index: 1,
  _paper: null,
  _page: null,
  pi,
})

describe('computeShares', () => {
  it('ranks by count and reports each share as a percentage of the rows in scope', () => {
    const rows = [
      row('T\'ien'),
      row('T\'ien'),
      row('T\'ien'),
      row('Olson'),
      row('Olson'),
    ]
    const result = computeShares(rows, pi)

    expect(result.groupLabel).toBe('Principle Investigator')
    expect(result.total).toBe(5)
    expect(result.shares.map((s) => s.label)).toEqual(['T\'ien', 'Olson'])
    expect(result.shares[0].share).toBeCloseTo(60)
    expect(result.shares[1].share).toBeCloseTo(40)
  })

  it('keeps the top N values and folds the remainder into a single Other bucket', () => {
    const rows = [
      row('A'),
      row('A'),
      row('B'),
      row('C'),
      row('D'),
      row('E'),
    ]
    const result = computeShares(rows, pi, { limit: 2 })

    expect(result.shares.map((s) => s.label)).toEqual(['A', 'B', 'Other'])
    // C, D and E are 1 row each -> 3 of 6 = 50%
    const other = result.shares.find((s) => s.other)
    expect(other?.count).toBe(3)
    expect(other?.share).toBeCloseTo(50)
  })

  it('labels blank and missing values instead of dropping them, so shares sum to 100%', () => {
    const rows = [row('A'), row(null), row(''), row(undefined as unknown as null), row('A')]
    const result = computeShares(rows, pi, { limit: 2 })

    const blank = result.shares.find((s) => s.label === '(blank)')
    expect(blank?.count).toBe(3)
    expect(result.shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(100)
  })

  it('breaks count ties deterministically by label', () => {
    const rows = [row('Zeta'), row('Alpha')]
    const result = computeShares(rows, pi)

    expect(result.shares.map((s) => s.label)).toEqual(['Alpha', 'Zeta'])
  })

  it('returns no shares for an empty dataset', () => {
    const result = computeShares([], pi)

    expect(result.shares).toEqual([])
    expect(result.total).toBe(0)
  })

  it('returns no shares when the column is unknown', () => {
    const rows = [row('A')]
    const result = computeShares(rows, null)

    expect(result.groupLabel).toBeNull()
    expect(result.shares).toEqual([])
  })
})
