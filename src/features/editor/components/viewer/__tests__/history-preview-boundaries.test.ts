import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('history preview source boundaries', () => {
  it('keeps reusable history preview presentation free of live data sources', () => {
    const previewViewer = readRepoFile(
      'src/features/editor/components/viewer/history-preview-viewer.tsx',
    )
    const banner = readRepoFile('src/features/editor/components/viewer/history-preview-banner.tsx')
    const rollbackDialog = readRepoFile(
      'src/features/editor/components/viewer/rollback-confirm-dialog.tsx',
    )

    expect(
      existsSync(
        join(repoRoot, 'src/features/editor/components/viewer/live-history-preview-viewer.tsx'),
      ),
    ).toBe(true)
    expect(
      existsSync(
        join(repoRoot, 'src/features/editor/components/viewer/live-rollback-confirm-dialog.tsx'),
      ),
    ).toBe(true)

    for (const fileText of [previewViewer, banner, rollbackDialog]) {
      for (const liveDependency of [
        'useCampaignQuery',
        'useCampaignMutation',
        'useAuthQuery',
        'useEditorMode',
        'useHistoryPreviewStore',
        'convex/_generated/api',
        'api.documentSnapshots',
        'api.editHistory',
      ]) {
        expect(fileText).not.toContain(liveDependency)
      }
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
