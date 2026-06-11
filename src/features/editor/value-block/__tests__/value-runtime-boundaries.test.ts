import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('note value runtime source boundaries', () => {
  it('keeps reusable value runtime free of live React data sources', () => {
    const provider = readRepoFile('src/features/editor/value-block/value-block-runtime.tsx')
    const liveSourcePath = 'src/features/editor/value-block/use-live-note-value-runtime-source.ts'

    expect(existsSync(join(repoRoot, liveSourcePath))).toBe(true)

    const liveSource = readRepoFile(liveSourcePath)

    expect(provider).toContain('NoteValueRuntimeSource')
    expect(liveSource).toContain('useLiveNoteValueRuntimeSource')
    expect(liveSource).toContain('useFilteredSidebarItems')
    expect(liveSource).toContain('useCampaignQuery')

    for (const liveDependency of [
      'useFilteredSidebarItems',
      'useCampaignQuery',
      'convex/_generated/api',
      'api.noteValues.queries',
    ]) {
      expect(provider).not.toContain(liveDependency)
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
