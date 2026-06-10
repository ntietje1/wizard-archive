import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('outline panel source boundaries', () => {
  it('keeps reusable outline presentation free of live data sources', () => {
    const outlinePanel = readRepoFile(
      'src/features/editor/components/right-sidebar/outline-panel.tsx',
    )
    const liveOutlinePanelPath =
      'src/features/editor/components/right-sidebar/live-outline-panel.tsx'

    expect(existsSync(join(repoRoot, liveOutlinePanelPath))).toBe(true)

    for (const liveDependency of [
      'useCampaignQuery',
      'convex/_generated/api',
      'api.blocks.queries',
      'useNoteEditorStore',
      'document.querySelector',
      'scrollIntoView',
    ]) {
      expect(outlinePanel).not.toContain(liveDependency)
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
