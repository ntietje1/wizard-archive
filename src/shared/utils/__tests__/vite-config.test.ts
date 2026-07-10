// @vitest-environment node

import path from 'node:path'
import { resolveConfig } from 'vite-plus'
import { describe, expect, it } from 'vite-plus/test'

describe('Vite config', () => {
  it('resolves editor package source only during development', async () => {
    const config = await resolveConfig({}, 'serve')
    const resolve = config.createResolver()

    await expect(resolveEditorRoot(resolve)).resolves.toBe(
      normalizedPath(path.resolve('packages/editor/src/index.ts')),
    )
    expect(config.environments.ssr.resolve.conditions).not.toContain('source')
  }, 60_000)

  it('keeps editor package source aliases out of production builds', async () => {
    const config = await resolveConfig({}, 'build')
    const resolve = config.createResolver()

    await expect(resolveEditorRoot(resolve)).resolves.toBe(
      normalizedPath(path.resolve('packages/editor/dist/index.mjs')),
    )
  }, 60_000)
})

async function resolveEditorRoot(
  resolve: (specifier: string, importer?: string) => Promise<string | undefined>,
) {
  const resolved = await resolve(
    '@wizard-archive/editor',
    path.resolve('src/editor-adapters/live/live-workspace-page.tsx'),
  )
  return resolved ? normalizedPath(resolved) : undefined
}

function normalizedPath(filePath: string) {
  return filePath.split(path.sep).join('/')
}
