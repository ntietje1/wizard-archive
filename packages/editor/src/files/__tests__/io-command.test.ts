import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { createFile } from '../../test/sidebar-item-factory'
import { executeFileIoCommand } from '../io-command'
import type { ResourceImportFile } from '../import-contract'

describe('executeFileIoCommand', () => {
  it('executes import and replace file commands through shared writer receipts', async () => {
    const fileItem = createFile({ id: 'file-handout' as SidebarItemId })
    const importFile = createImportFile('handout.png')
    const writeFile = vi.fn(() => Promise.resolve())
    const executor = {
      canReplaceFile: () => true,
      getFileTargetById: (fileId: SidebarItemId) => (fileId === fileItem.id ? fileItem : null),
      writeFile,
    }

    await expect(
      executeFileIoCommand({ type: 'importFile', file: importFile, fileId: fileItem.id }, executor),
    ).resolves.toEqual({
      status: 'completed',
      receipt: { kind: 'fileImported', itemId: fileItem.id, affectedCount: 1 },
    })
    await expect(
      executeFileIoCommand(
        { type: 'replaceFile', file: importFile, fileId: fileItem.id },
        executor,
      ),
    ).resolves.toEqual({
      status: 'completed',
      receipt: { kind: 'fileReplaced', itemId: fileItem.id, affectedCount: 1 },
    })
    expect(writeFile).toHaveBeenCalledTimes(2)
  })

  it('maps validation and writer failures before command-specific receipts', async () => {
    const fileItem = createFile({ id: 'file-handout' as SidebarItemId })
    const oversizedFile = createImportFile('oversized.png', { size: 200 })
    const writeError = new Error('Write failed')
    const writeFile = vi.fn(() => Promise.reject(writeError))
    const executor = {
      canReplaceFile: () => true,
      getFileTargetById: (fileId: SidebarItemId) => (fileId === fileItem.id ? fileItem : null),
      maxUploadBytes: 100,
      writeFile,
    }

    await expect(
      executeFileIoCommand(
        { type: 'importFile', file: oversizedFile, fileId: fileItem.id },
        executor,
      ),
    ).resolves.toMatchObject({ status: 'error' })
    expect(writeFile).not.toHaveBeenCalled()

    await expect(
      executeFileIoCommand(
        { type: 'replaceFile', file: createImportFile('replacement.png'), fileId: fileItem.id },
        executor,
      ),
    ).resolves.toEqual({ status: 'error', error: writeError })
  })

  it('returns unavailable replacement results before writing missing targets', async () => {
    const writeFile = vi.fn()

    await expect(
      executeFileIoCommand(
        {
          type: 'replaceFile',
          file: createImportFile('replacement.png'),
          fileId: 'missing' as SidebarItemId,
        },
        {
          canReplaceFile: () => true,
          getFileTargetById: () => null,
          writeFile,
        },
      ),
    ).resolves.toEqual({ status: 'unavailable', reason: 'file_not_found' })
    expect(writeFile).not.toHaveBeenCalled()
  })
})

function createImportFile(name: string, overrides: Partial<ResourceImportFile> = {}) {
  return {
    name,
    contentType: 'image/png',
    size: 12,
    arrayBuffer: () => new ArrayBuffer(0),
    text: () => '',
    ...overrides,
  } satisfies ResourceImportFile
}
