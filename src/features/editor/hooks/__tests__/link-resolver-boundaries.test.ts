import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('link resolver source boundaries', () => {
  it('keeps reusable link resolution free of live React data sources', () => {
    const pureResolverPath = 'src/features/editor/links/link-resolver.ts'
    const liveHook = readRepoFile('src/features/editor/hooks/useLinkResolver.ts')
    const noteView = readRepoFile('src/features/editor/components/note-view.tsx')
    const noteEditorCore = readRepoFile('src/features/editor/components/note-editor-core.tsx')

    expect(existsSync(join(repoRoot, pureResolverPath))).toBe(true)

    const pureResolver = readRepoFile(pureResolverPath)

    expect(pureResolver).toContain('createLinkResolver')
    expect(liveHook).toContain('createLinkResolver')
    expect(liveHook).toContain('useCampaign')
    expect(liveHook).toContain('useFilteredSidebarItems')
    expect(noteView).toContain('~/features/editor/links/link-resolver')
    expect(noteEditorCore).toContain('~/features/editor/links/link-resolver')
    expect(noteView).not.toContain('~/features/editor/hooks/useLinkResolver')
    expect(noteEditorCore).not.toContain('~/features/editor/hooks/useLinkResolver')

    for (const liveDependency of [
      'useCampaign',
      'useFilteredSidebarItems',
      'useCampaignQuery',
      'convex/_generated/api',
      '/campaigns/',
      "from 'react'",
      'from "react"',
    ]) {
      expect(pureResolver).not.toContain(liveDependency)
    }
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}
