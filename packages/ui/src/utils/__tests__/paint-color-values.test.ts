import { afterEach, describe, expect, it } from 'vite-plus/test'
import { paintColorValuesEqual } from '../paint-color-values'

describe('paintColorValuesEqual', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--paint-test-black')
    document.documentElement.style.removeProperty('--paint-test-background')
    document.documentElement.style.removeProperty('--paint-test-foreground')
  })

  it('treats a CSS variable that resolves to black as black', () => {
    document.documentElement.style.setProperty('--paint-test-black', '#000000')

    expect(
      paintColorValuesEqual(
        { color: 'var(--paint-test-black)', opacity: 100 },
        { color: '#000000', opacity: 100 },
      ),
    ).toBe(true)
  })

  it('does not collapse unresolved CSS variables into black', () => {
    expect(
      paintColorValuesEqual(
        { color: 'var(--paint-test-black)', opacity: 100 },
        { color: '#000000', opacity: 100 },
      ),
    ).toBe(false)
  })

  it('does not collapse distinct CSS variables with non-hex resolved theme values', () => {
    document.documentElement.style.setProperty('--paint-test-background', 'oklch(0.14 0.01 303)')
    document.documentElement.style.setProperty(
      '--paint-test-foreground',
      'oklch(0.95 0.01416 303.899)',
    )

    expect(
      paintColorValuesEqual(
        { color: 'var(--paint-test-background)', opacity: 100 },
        { color: 'var(--paint-test-foreground)', opacity: 100 },
      ),
    ).toBe(false)
  })
})
