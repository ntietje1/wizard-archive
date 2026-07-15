import { describe, expect, it } from 'vite-plus/test'

const contractModule = await import('../../../../scripts/editor-parity-contract.mjs')
const parityModule = await import('../../../../scripts/editor-parity.mjs')
const { editorParityContract } = contractModule
const { analyzeEditorParityAcceptance, analyzeEditorParityContract, loadEditorParityInputs } =
  parityModule

describe('editor restoration parity contract', () => {
  it('assigns every deleted path and all 47 deleted E2E specs', () => {
    const { deletedPaths } = loadEditorParityInputs()
    expect(analyzeEditorParityContract(editorParityContract, deletedPaths)).toEqual([])
    expect(editorParityContract.deletedE2eOwners.flatMap(({ specs }) => specs)).toHaveLength(47)
  })

  it('rejects a newly unassigned deleted path', () => {
    expect(
      analyzeEditorParityContract(editorParityContract, ['packages/editor/src/unknown/view.tsx']),
    ).toContainEqual({
      className: 'unassigned_deleted_path',
      path: 'packages/editor/src/unknown/view.tsx',
    })
  })

  it.each([
    ['folder_label_only', '<SurfaceState label="Folder" />'],
    ['note_textarea', '<textarea aria-label="Note content" />'],
    ['file_metadata_only', '`${content.byteSize} bytes`'],
    ['map_pin_count_only', '`${content.pins.length} pins`'],
    ['canvas_label_only', '<SurfaceState label="Canvas" />'],
    ['hardcoded_empty_player_projection', 'const players = []'],
  ])('rejects the %s placeholder', (placeholder, source) => {
    expect(
      analyzeEditorParityAcceptance(editorParityContract, [
        { path: 'packages/editor/src/resources/example.tsx', source },
      ]),
    ).toContainEqual({
      className: `placeholder_${placeholder}`,
      path: 'packages/editor/src/resources/example.tsx',
    })
  })
})
