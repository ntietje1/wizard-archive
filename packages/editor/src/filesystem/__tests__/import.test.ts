import { describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { ResourceSlug } from '../../workspace/resource-contract'
import { createResourceCatalogModel } from '../catalog'
import type { FileSystemCreateItem, ResourceImportFileOperation } from '../item-operation-contracts'
import { importWorkspaceFile, importWorkspaceFileDrop } from '../import'
import { createBrowserImportFile } from '../browser-import-file'
import { createFile, createFolder } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { completedResourceOperation } from '../transaction-contract'

function createImportFile(parts: Array<BlobPart>, name: string, options: FilePropertyBag) {
  return createBrowserImportFile(new File(parts, name, options))
}

describe('importWorkspaceFile', () => {
  function createSuccessfulFileImport(fileId = testId<'sidebarItems'>('imported-file')) {
    return completedResourceOperation({
      kind: 'fileImported',
      itemId: fileId,
      affectedCount: 1,
    })
  }

  it('validates, dedupes, and routes text files through note import', async () => {
    const parentId = testId<'sidebarItems'>('parent')
    const parent = createFolder({ id: parentId, name: 'Session' })
    const existingText = createFile({ name: 'notes.txt', parentId })
    const catalog = createResourceCatalogModel({
      activeItems: [parent, existingText],
      trashItems: [],
    }).catalog
    const initializeImportedFile = vi.fn(() => createSuccessfulFileImport())
    const initializeImportedTextFile = vi.fn()
    const createItem = vi.fn<FileSystemCreateItem>(async ({ name }, initialize) => {
      const created = {
        status: 'completed' as const,
        id: testId<'sidebarItems'>(`note-${name}`),
        slug: `note-${name}` as ResourceSlug,
      }
      await initialize?.(created, createItem)
      return created
    })
    const text = createImportFile(['hello'], 'notes.txt', { type: 'text/plain' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: { initializeImportedFile, initializeImportedTextFile },
      input: { file: text, parentId },
    })

    expect(createItem).toHaveBeenCalledWith(
      {
        type: RESOURCE_TYPES.notes,
        parentTarget: { kind: 'direct', parentId },
        name: 'notes.txt 1',
      },
      expect.any(Function),
    )
    expect(initializeImportedTextFile).toHaveBeenCalledWith({
      file: text,
      noteId: testId<'sidebarItems'>('note-notes.txt 1'),
    })
    expect(result).toEqual({
      status: 'imported',
      kind: 'note',
      fileName: 'notes.txt 1',
      result: {
        status: 'completed',
        id: testId<'sidebarItems'>('note-notes.txt 1'),
        slug: 'note-notes.txt 1',
      },
    })
  })

  it('routes media files through media import with deduped progress names', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const initializeImportedFile = vi.fn(({ fileId }) => createSuccessfulFileImport(fileId))
    const initializeImportedTextFile = vi.fn()
    const createItem = vi.fn<FileSystemCreateItem>(async ({ name }, initialize) => {
      const created = {
        status: 'completed' as const,
        id: testId<'sidebarItems'>(`file-${name}`),
        slug: `file-${name}` as ResourceSlug,
      }
      await initialize?.(created, createItem)
      return created
    })
    const onProgress = vi.fn()
    const image = createImportFile(['image'], 'portrait.png', { type: 'image/png' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: { initializeImportedFile, initializeImportedTextFile },
      input: { file: image, parentId: null, onProgress },
    })

    const progress = initializeImportedFile.mock.calls[0]?.[0].onProgress
    progress?.(47)

    expect(createItem).toHaveBeenCalledWith(
      {
        type: RESOURCE_TYPES.files,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'portrait.png',
      },
      expect.any(Function),
    )
    expect(initializeImportedFile).toHaveBeenCalledWith({
      file: image,
      fileId: testId<'sidebarItems'>('file-portrait.png'),
      onProgress: expect.any(Function),
    })
    expect(onProgress).toHaveBeenCalledWith({ fileName: 'portrait.png', percentage: 47 })
    expect(result).toEqual({
      status: 'imported',
      kind: 'file',
      fileName: 'portrait.png',
      result: {
        status: 'completed',
        id: testId<'sidebarItems'>('file-portrait.png'),
        slug: 'file-portrait.png',
      },
    })
  })

  it('uses supported media extensions when browser MIME data is empty', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const initializeImportedFile = vi.fn(({ fileId }) => createSuccessfulFileImport(fileId))
    const initializeImportedTextFile = vi.fn()
    const createItem = vi.fn<FileSystemCreateItem>(({ name }) => ({
      status: 'completed',
      id: testId<'sidebarItems'>(`file-${name}`),
      slug: `file-${name}` as ResourceSlug,
    }))
    const image = createImportFile(['image'], 'portrait.png', { type: '' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: { initializeImportedFile, initializeImportedTextFile },
      input: { file: image, parentId: null },
    })

    expect(createItem).toHaveBeenCalledWith(
      {
        type: RESOURCE_TYPES.files,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'portrait.png',
      },
      expect.any(Function),
    )
    expect(result).toMatchObject({ status: 'imported', kind: 'file', fileName: 'portrait.png' })
  })

  it('reports media initializer errors as failed imports', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const uploadError = new Error('Upload failed')
    const initializeImportedFile = vi.fn(() => ({
      status: 'error' as const,
      error: uploadError,
    }))
    const initializeImportedTextFile = vi.fn()
    const createItem = vi.fn<FileSystemCreateItem>(async ({ name }, initialize) => {
      const created = {
        status: 'completed' as const,
        id: testId<'sidebarItems'>(`file-${name}`),
        slug: `file-${name}` as ResourceSlug,
      }
      try {
        await initialize?.(created, createItem)
      } catch (error) {
        return { status: 'failed', reason: 'create_failed', error }
      }
      return created
    })
    const image = createImportFile(['image'], 'portrait.png', { type: 'image/png' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: { initializeImportedFile, initializeImportedTextFile },
      input: { file: image, parentId: null },
    })

    expect(result).toEqual({
      status: 'skipped',
      fileName: 'portrait.png',
      reason: 'failed',
      error: uploadError,
    })
  })

  it('reports item creation failures separately from unsupported imports', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const createItem = vi.fn<FileSystemCreateItem>(() => ({
      status: 'failed',
      reason: 'create_failed',
    }))
    const text = createImportFile(['hello'], 'notes.txt', { type: 'text/plain' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: {
        initializeImportedFile: vi.fn(() => createSuccessfulFileImport()),
        initializeImportedTextFile: vi.fn(),
      },
      input: { file: text, parentId: null },
    })

    expect(result).toEqual({ status: 'skipped', fileName: 'notes.txt', reason: 'failed' })
  })

  it('reports rejected text item creation as a failed import', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const error = new Error('Create failed')
    const createItem = vi.fn<FileSystemCreateItem>().mockRejectedValue(error)
    const text = createImportFile(['hello'], 'notes.txt', { type: 'text/plain' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: {
        initializeImportedFile: vi.fn(() => createSuccessfulFileImport()),
        initializeImportedTextFile: vi.fn(),
      },
      input: { file: text, parentId: null },
    })

    expect(result).toEqual({ status: 'skipped', fileName: 'notes.txt', reason: 'failed', error })
  })

  it('reports rejected media item creation as a failed import', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const error = new Error('Create failed')
    const createItem = vi.fn<FileSystemCreateItem>().mockRejectedValue(error)
    const image = createImportFile(['image'], 'portrait.png', { type: 'image/png' })

    const result = await importWorkspaceFile({
      catalog,
      createItem,
      initializers: {
        initializeImportedFile: vi.fn(() => createSuccessfulFileImport()),
        initializeImportedTextFile: vi.fn(),
      },
      input: { file: image, parentId: null },
    })

    expect(result).toEqual({
      status: 'skipped',
      fileName: 'portrait.png',
      reason: 'failed',
      error,
    })
  })
})

describe('importWorkspaceFileDrop', () => {
  it('imports root files and nested folders through filesystem primitives', async () => {
    const parentId = testId<'sidebarItems'>('parent')
    const parent = createFolder({ id: parentId, name: 'Session' })
    const catalog = createResourceCatalogModel({
      activeItems: [parent],
      trashItems: [],
    }).catalog
    const createItem = vi.fn<FileSystemCreateItem>(({ name }) => ({
      status: 'completed',
      id: testId<'sidebarItems'>(`created-${name}`),
      slug: `created-${name}` as ResourceSlug,
    }))
    const importFile = vi.fn<ResourceImportFileOperation>(({ file }) => ({
      status: 'imported',
      kind: file.contentType.startsWith('text/') ? 'note' : 'file',
      fileName: file.name,
      result: {
        status: 'completed',
        id: testId<'sidebarItems'>(`imported-${file.name}`),
        slug: `imported-${file.name}` as ResourceSlug,
      },
    }))
    const onProgress = vi.fn()
    const image = createImportFile(['image'], 'portrait.png', { type: 'image/png' })
    const text = createImportFile(['hello'], 'notes.txt', { type: 'text/plain' })
    const nestedText = createImportFile(['nested'], 'nested.txt', { type: 'text/plain' })

    const receipt = await importWorkspaceFileDrop({
      catalog,
      input: {
        files: [{ file: text }],
        rootFolders: [
          {
            name: 'Assets',
            files: [{ file: image }],
            subfolders: [{ name: 'Nested', files: [{ file: nestedText }], subfolders: [] }],
          },
        ],
        parentId,
        onProgress,
      },
      operations: { createItem, importFile },
    })

    expect(importFile).toHaveBeenCalledWith({
      file: text,
      parentId,
      onProgress: expect.any(Function),
    })
    expect(createItem).toHaveBeenNthCalledWith(1, {
      type: RESOURCE_TYPES.folders,
      name: 'Assets',
      parentTarget: { kind: 'direct', parentId },
    })
    expect(importFile).toHaveBeenCalledWith({
      file: image,
      parentId: testId<'sidebarItems'>('created-Assets'),
      onProgress: expect.any(Function),
    })
    expect(createItem).toHaveBeenNthCalledWith(2, {
      type: RESOURCE_TYPES.folders,
      name: 'Nested',
      parentTarget: { kind: 'direct', parentId: testId<'sidebarItems'>('created-Assets') },
    })
    expect(importFile).toHaveBeenCalledWith({
      file: nestedText,
      parentId: testId<'sidebarItems'>('created-Nested'),
      onProgress: expect.any(Function),
    })
    expect(receipt).toMatchObject({
      processedFiles: 3,
      processedFolders: 2,
      lastFolderId: testId<'sidebarItems'>('created-Nested'),
    })
    expect(onProgress).toHaveBeenLastCalledWith({
      processedFiles: 3,
      processedFolders: 2,
      skippedFiles: 0,
    })
  })

  it('reports skipped files through the import receipt', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const invalid = createImportFile(['unknown'], 'archive.unknown', {
      type: 'application/octet-stream',
    })
    const createItem = vi.fn<FileSystemCreateItem>()
    const importFile = vi.fn<ResourceImportFileOperation>(({ file }) => ({
      status: 'skipped',
      fileName: file.name,
      reason: 'invalid',
      error: 'Invalid file',
    }))

    const receipt = await importWorkspaceFileDrop({
      catalog,
      input: {
        files: [{ file: invalid }],
        rootFolders: [],
        parentId: null,
      },
      operations: { createItem, importFile },
    })

    expect(importFile).toHaveBeenCalledWith({
      file: invalid,
      parentId: null,
      onProgress: expect.any(Function),
    })
    expect(receipt).toMatchObject({
      skippedFiles: 1,
      skippedFileDetails: [{ fileName: 'archive.unknown', reason: 'invalid' }],
    })
  })

  it('counts descendants as skipped when their parent folder cannot be created', async () => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const createItem = vi.fn<FileSystemCreateItem>(({ name }) => {
      if (name === 'Broken') return { status: 'failed', reason: 'create_failed' }
      return {
        status: 'completed',
        id: testId<'sidebarItems'>(`created-${name}`),
        slug: `created-${name}` as ResourceSlug,
      }
    })
    const importFile = vi.fn<ResourceImportFileOperation>(({ file }) => ({
      status: 'imported',
      kind: 'note',
      fileName: file.name,
      result: {
        status: 'completed',
        id: testId<'sidebarItems'>(`imported-${file.name}`),
        slug: `imported-${file.name}` as ResourceSlug,
      },
    }))
    const onProgress = vi.fn()
    const workingFile = createImportFile(['working'], 'working.txt', { type: 'text/plain' })
    const brokenFile = createImportFile(['broken'], 'broken.txt', { type: 'text/plain' })
    const nestedBrokenFile = createImportFile(['nested broken'], 'nested-broken.txt', {
      type: 'text/plain',
    })

    const receipt = await importWorkspaceFileDrop({
      catalog,
      input: {
        files: [],
        rootFolders: [
          {
            name: 'Broken',
            files: [{ file: brokenFile }],
            subfolders: [
              {
                name: 'Nested Broken',
                files: [{ file: nestedBrokenFile }],
                subfolders: [],
              },
            ],
          },
          { name: 'Working', files: [{ file: workingFile }], subfolders: [] },
        ],
        parentId: null,
        onProgress,
      },
      operations: { createItem, importFile },
    })

    expect(createItem).toHaveBeenNthCalledWith(1, {
      type: RESOURCE_TYPES.folders,
      name: 'Broken',
      parentTarget: { kind: 'direct', parentId: null },
    })
    expect(createItem).toHaveBeenNthCalledWith(2, {
      type: RESOURCE_TYPES.folders,
      name: 'Working',
      parentTarget: { kind: 'direct', parentId: null },
    })
    expect(importFile).toHaveBeenCalledWith({
      file: workingFile,
      parentId: testId<'sidebarItems'>('created-Working'),
      onProgress: expect.any(Function),
    })
    expect(receipt).toMatchObject({
      processedFiles: 1,
      processedFolders: 1,
      skippedFiles: 4,
      lastFolderId: testId<'sidebarItems'>('created-Working'),
      skippedFileDetails: [{ fileName: 'Broken', reason: 'failed' }],
    })
    expect(onProgress).toHaveBeenLastCalledWith({
      processedFiles: 1,
      processedFolders: 1,
      skippedFiles: 4,
    })
  })

  it('deduplicates dropped folder names against visible and same-drop siblings', async () => {
    const existingAssets = createFolder({ name: 'Assets' })
    const catalog = createResourceCatalogModel({
      activeItems: [existingAssets],
      trashItems: [],
    }).catalog
    let createCount = 0
    const createItem = vi.fn<FileSystemCreateItem>(({ name }) => {
      createCount++
      return {
        status: 'completed',
        id: testId<'sidebarItems'>(`created-${createCount}`),
        slug: `created-${name}` as ResourceSlug,
      }
    })
    const importFile = vi.fn<ResourceImportFileOperation>()

    const receipt = await importWorkspaceFileDrop({
      catalog,
      input: {
        files: [],
        rootFolders: [
          {
            name: 'Assets',
            files: [],
            subfolders: [
              { name: 'Scenes', files: [], subfolders: [] },
              { name: 'Scenes', files: [], subfolders: [] },
            ],
          },
          { name: 'Assets', files: [], subfolders: [] },
        ],
        parentId: null,
      },
      operations: { createItem, importFile },
    })

    expect(createItem).toHaveBeenNthCalledWith(1, {
      type: RESOURCE_TYPES.folders,
      name: 'Assets 1',
      parentTarget: { kind: 'direct', parentId: null },
    })
    expect(createItem).toHaveBeenNthCalledWith(2, {
      type: RESOURCE_TYPES.folders,
      name: 'Scenes',
      parentTarget: { kind: 'direct', parentId: testId<'sidebarItems'>('created-1') },
    })
    expect(createItem).toHaveBeenNthCalledWith(3, {
      type: RESOURCE_TYPES.folders,
      name: 'Scenes 1',
      parentTarget: { kind: 'direct', parentId: testId<'sidebarItems'>('created-1') },
    })
    expect(createItem).toHaveBeenNthCalledWith(4, {
      type: RESOURCE_TYPES.folders,
      name: 'Assets 2',
      parentTarget: { kind: 'direct', parentId: null },
    })
    expect(receipt).toMatchObject({
      processedFolders: 4,
      skippedFiles: 0,
      lastFolderId: testId<'sidebarItems'>('created-4'),
    })
  })
})
