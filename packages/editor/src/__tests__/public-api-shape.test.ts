import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

const root = process.cwd()
const editorPackagePath = path.join(root, 'packages/editor/package.json')

describe('@wizard-archive/editor public architecture', () => {
  it('maps every JavaScript export to one package-owned source module', () => {
    const packageJson = JSON.parse(readFileSync(editorPackagePath, 'utf8')) as {
      exports: Record<string, string | { default: string }>
    }

    for (const target of Object.values(packageJson.exports)) {
      if (typeof target === 'string') continue
      const sourceStem = target.default.replace('./dist/', '').replace(/\.mjs$/, '')
      const candidates = [
        path.join(root, 'packages/editor/src', `${sourceStem}.ts`),
        path.join(root, 'packages/editor/src', `${sourceStem}.tsx`),
      ]
      expect(candidates.some((candidate) => existsSync(candidate))).toBe(true)
    }
  })

  it('keeps backend-safe exports on leaf contracts instead of UI roots', () => {
    const packageJson = JSON.parse(readFileSync(editorPackagePath, 'utf8')) as {
      wizardArchive: { backendSafeSubpaths: Array<string> }
    }

    expect(packageJson.wizardArchive.backendSafeSubpaths).not.toEqual(
      expect.arrayContaining(['.', './adapter', './runtime']),
    )
  })

  it('keeps the local root on the canonical fixture and runtime only', () => {
    const localDirectory = path.join(root, 'src/editor-adapters/local')
    const sourceFiles = readdirSync(localDirectory)
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .sort()

    expect(sourceFiles).toEqual([
      'demo-navigation.ts',
      'local-workspace-fixture.ts',
      'local-workspace-runtime-host.tsx',
      'public-demo-workspace-presets.ts',
      'sample-local-workspace.ts',
      'use-local-workspace-runtime.ts',
    ])
    const runtimeSource = readFileSync(
      path.join(localDirectory, 'use-local-workspace-runtime.ts'),
      'utf8',
    )
    expect(runtimeSource).toContain('@wizard-archive/editor/resources/in-memory-editor-runtime')
    expect(runtimeSource).not.toMatch(/filesystem|adapter/)
  })
})
