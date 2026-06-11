import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('wiki link autocomplete source boundaries', () => {
  it('keeps the reusable autocomplete component free of live data sources', () => {
    const component = readRepoFile(
      'src/features/editor/components/extensions/wiki-link/wiki-link-autocomplete.tsx',
    )
    const liveSourcePath =
      'src/features/editor/components/extensions/wiki-link/use-live-wiki-link-autocomplete-source.ts'
    const liveWrapperPath =
      'src/features/editor/components/extensions/wiki-link/live-wiki-link-autocomplete.tsx'

    expect(existsSync(join(repoRoot, liveSourcePath))).toBe(true)
    expect(existsSync(join(repoRoot, liveWrapperPath))).toBe(true)

    expect(component).toContain('modelData')

    for (const liveDependency of [
      'useFilteredSidebarItems',
      'useCampaignQuery',
      'convex/_generated/api',
      'api.blocks.queries',
      'api.noteValues.queries',
      'NoteValueRuntimeContext',
    ]) {
      expect(component).not.toContain(liveDependency)
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
