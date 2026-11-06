/** The links between the Data Table and the sandbox (workspace/links.ts). */
import { describe, it, expect } from 'vitest'
import {
  cleanTestId,
  isPlainClick,
  sandboxHref,
  tableHref,
} from '@/app/(frontend)/dashboard/components/workspace/links'

describe('workspace links', () => {
  it('builds the two URLs, keeping an explicit dataset', () => {
    expect(sandboxHref('B14')).toBe('/dashboard?tab=sandbox&preset=B14')
    expect(tableHref('B14')).toBe('/dashboard?tab=visualization&test=B14')
    expect(sandboxHref('T28a', '4')).toBe('/dashboard?dataset=4&tab=sandbox&preset=T28a')
    expect(tableHref('SF1-S1', '4')).toBe('/dashboard?dataset=4&tab=visualization&test=SF1-S1')
  })

  it('accepts only plain test ids from a URL', () => {
    expect(cleanTestId('B14')).toBe('B14')
    expect(cleanTestId('T28a')).toBe('T28a')
    expect(cleanTestId('SF2-5')).toBe('SF2-5')
    for (const bad of [undefined, '', ['B14'], 'B14<script>', 'B 14', 'x'.repeat(17), '../B14']) {
      expect(cleanTestId(bad)).toBeNull()
    }
  })

  it('leaves modified clicks (new tab, new window) to the browser', () => {
    const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
    expect(isPlainClick(click)).toBe(true)
    expect(isPlainClick({ ...click, ctrlKey: true })).toBe(false)
    expect(isPlainClick({ ...click, metaKey: true })).toBe(false)
    expect(isPlainClick({ ...click, shiftKey: true })).toBe(false)
    expect(isPlainClick({ ...click, button: 1 })).toBe(false)
  })
})
