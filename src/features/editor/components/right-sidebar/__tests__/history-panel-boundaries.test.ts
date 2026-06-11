import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('history panel source boundaries', () => {
  it('keeps reusable history panel presentation free of live data sources', () => {
    const historyPanel = readRepoFile(
      'src/features/editor/components/right-sidebar/history-panel.tsx',
    )
    const liveHistoryPanelPath =
      'src/features/editor/components/right-sidebar/live-history-panel.tsx'

    expect(existsSync(join(repoRoot, liveHistoryPanelPath))).toBe(true)

    for (const liveDependency of [
      'useAuthPaginatedQuery',
      'useCampaignMembers',
      'useCampaign',
      'useEditorMode',
      'useHistoryPreviewStore',
      'convex/_generated/api',
      'api.editHistory',
    ]) {
      expect(historyPanel).not.toContain(liveDependency)
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
