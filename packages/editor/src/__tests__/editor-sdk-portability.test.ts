import { describe, expect, it } from 'vite-plus/test'

const portabilityModulePath = '../../../../scripts/editor-sdk-portability.mjs'
const portabilityModule = await import(portabilityModulePath)

interface EditorSdkPortabilityLiabilities {
  allowImportingTsExtensions: boolean
  externalSpecifiers: Array<string>
  hostSingletonDependencySpecifiers: Array<string>
  missingExportFiles: Array<string>
  missingHostSingletonPeerSpecifiers: Array<string>
  nodeBuiltinSpecifiers: Array<string>
  noEmit: boolean
  outOfPackageRelativeImports: Array<string>
  privatePackage: boolean
  privateWorkspaceExternalSpecifiers: Array<string>
  sourceOnlyExportTargets: Array<string>
  undeclaredExternalSpecifiers: Array<string>
  workspacePackageSpecifiers: Array<string>
}

const {
  validateBuiltEditorPackageImports,
  validateEditorSdkPortability,
}: {
  validateBuiltEditorPackageImports: () => Promise<Array<string>>
  validateEditorSdkPortability: () => {
    errors: Array<string>
    liabilities: EditorSdkPortabilityLiabilities
  }
} = portabilityModule

describe('editor SDK portability', () => {
  it('keeps distributable package output dependency-closed', () => {
    const { errors, liabilities } = validateEditorSdkPortability()

    expect(errors).toEqual([])
    expect(liabilities.privatePackage).toBe(false)
    expect(liabilities.sourceOnlyExportTargets).toEqual([])
    expect(liabilities.missingExportFiles).toEqual([])
    expect(liabilities.outOfPackageRelativeImports).toEqual([])
    expect(liabilities.nodeBuiltinSpecifiers).toEqual([])
    expect(liabilities.undeclaredExternalSpecifiers).toEqual([])
    expect(liabilities.privateWorkspaceExternalSpecifiers).toEqual([])
    expect(liabilities.workspacePackageSpecifiers).toEqual([])
    expect(liabilities.hostSingletonDependencySpecifiers).toEqual([])
    expect(liabilities.missingHostSingletonPeerSpecifiers).toEqual([])
  })

  it('resolves and imports every built code entrypoint through the package export map', async () => {
    await expect(validateBuiltEditorPackageImports()).resolves.toEqual([])
  }, 30_000)
})
