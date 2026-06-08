import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('useEmbedUpload import boundary', () => {
  it('does not depend on the DnD drop handler', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/embeds/hooks/use-embed-upload.ts'),
      'utf8',
    )

    expect(source).not.toContain('features/dnd/hooks/useFileDropHandler')
  })
})
