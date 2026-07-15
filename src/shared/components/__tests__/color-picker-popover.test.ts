import { describe, expect, it } from 'vite-plus/test'
import { normalizePickerColor } from '@wizard-archive/ui/utils/color'

describe('normalizePickerColor', () => {
  it('resolves CSS variable colors for the detailed picker', () => {
    const resolvedColor = normalizePickerColor('var(--t-red)', (variableName) =>
      variableName === '--t-red' ? '#ff7369' : null,
    )

    expect(resolvedColor).toBe('#ff7369')
  })

  it('falls back to black when a CSS variable cannot be resolved', () => {
    expect(normalizePickerColor('var(--missing-color)', () => null)).toBe('#000000')
  })
})
