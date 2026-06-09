import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('useFileDropHandler import boundary', () => {
  it('does not depend on embed feature ownership', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/dnd/hooks/useFileDropHandler.tsx'),
      'utf8',
    )

    expect(source).not.toContain('features/embeds')
  })
})
