import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

describe('preview surface ownership', () => {
  it('keeps canvas resource embeds on the shared preview surface instead of the workspace sidebar delegate', () => {
    const source = readFileSync(
      'packages/editor/src/embeds/components/canvas-resource-embed-surface.tsx',
      'utf8',
    )

    expect(source).toContain('../../previews/resource-preview-surface')
    expect(source).not.toContain('../../workspace/sidebar/preview-content')
  })
})
