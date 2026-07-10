import { isMediaFile, isTextFile } from '../../../../shared/storage/validation'
import { deduplicateName } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import { validateFileIoInput } from '../files/io-command'
import type { ResourceCatalog } from './catalog'
import type { ResourceImportContentInitializers } from '../files/import-contract'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceOperationResult } from './transaction-contract'
import type {
  FileSystemItemCreateOperations,
  FileSystemItemDropImportOperations,
  FileSystemItemImportOperations,
} from './item-operation-contracts'

type ImportFileInput = Parameters<FileSystemItemImportOperations['importFile']>[0]
type ImportFileResult = Awaited<ReturnType<FileSystemItemImportOperations['importFile']>>
type ImportFileKind = NonNullable<ImportFileInput['acceptedKinds']>[number]
type ImportDropInput = Parameters<FileSystemItemDropImportOperations['importDrop']>[0]
type ImportDropProgress = Parameters<NonNullable<ImportDropInput['onProgress']>>[0]
type ImportDropResult = Awaited<ReturnType<FileSystemItemDropImportOperations['importDrop']>>
type ImportDropSkippedFile = ImportDropResult['skippedFileDetails'][number]
type ImportFileEntry = ImportDropInput['files'][number]
type ImportFolderEntry = ImportDropInput['rootFolders'][number]
type CreateItemResult = Awaited<ReturnType<FileSystemItemCreateOperations['createItem']>>

export async function importWorkspaceFile({
  catalog,
  createItem,
  initializers,
  input,
  maxUploadBytes,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  createItem: FileSystemItemCreateOperations['createItem']
  initializers: ResourceImportContentInitializers
  input: ImportFileInput
  maxUploadBytes?: number
}): Promise<ImportFileResult> {
  const fileName = deduplicateName(
    input.file.name,
    catalog.getVisibleChildren(input.parentId).map((sibling) => sibling.name),
  )
  const validation = validateFileIoInput(input.file, maxUploadBytes)
  if (validation.status === 'invalid') {
    return { status: 'skipped', fileName, reason: 'invalid', error: validation.error }
  }

  if (isTextFile(input.file.contentType, input.file.name)) {
    if (!acceptsImportKind(input, 'note')) {
      return { status: 'skipped', fileName, reason: 'unsupported' }
    }
    let result: CreateItemResult
    try {
      result = await createItem(
        {
          type: RESOURCE_TYPES.notes,
          name: fileName,
          parentTarget: { kind: 'direct', parentId: input.parentId },
        },
        async ({ id }) => {
          await initializers.initializeImportedTextFile({
            file: input.file,
            noteId: id,
          })
        },
      )
    } catch (error) {
      return { status: 'skipped', fileName, reason: 'failed', error }
    }
    return mapCreateItemResultToImportResult({ fileName, kind: 'note', result })
  }

  if (isMediaFile(input.file.contentType, input.file.name)) {
    if (!acceptsImportKind(input, 'file')) {
      return { status: 'skipped', fileName, reason: 'unsupported' }
    }
    let result: CreateItemResult
    try {
      result = await createItem(
        {
          type: RESOURCE_TYPES.files,
          name: fileName,
          parentTarget: { kind: 'direct', parentId: input.parentId },
        },
        async ({ id }) => {
          const initialization = await initializers.initializeImportedFile({
            file: input.file,
            fileId: id,
            onProgress: (percentage) => input.onProgress?.({ fileName, percentage }),
          })
          assertImportFileInitialized(initialization)
        },
      )
    } catch (error) {
      return { status: 'skipped', fileName, reason: 'failed', error }
    }
    return mapCreateItemResultToImportResult({ fileName, kind: 'file', result })
  }

  return { status: 'skipped', fileName, reason: 'unsupported' }
}

function acceptsImportKind(input: ImportFileInput, kind: ImportFileKind) {
  return input.acceptedKinds === undefined || input.acceptedKinds.includes(kind)
}

function assertImportFileInitialized(result: ResourceOperationResult) {
  if (result.status === 'completed') return
  if (result.status === 'error' && result.error !== undefined) throw result.error
  throw new Error(`Failed to initialize imported file: ${result.status}`)
}

function mapCreateItemResultToImportResult({
  fileName,
  kind,
  result,
}: {
  fileName: string
  kind: ImportFileKind
  result: CreateItemResult
}): ImportFileResult {
  if (result.status === 'completed') {
    return { status: 'imported', kind, fileName, result }
  }
  if (result.status === 'unavailable') {
    return { status: 'skipped', fileName, reason: 'unavailable' }
  }
  return { status: 'skipped', fileName, reason: 'failed', error: result.error }
}

export async function importWorkspaceFileDrop({
  catalog,
  input,
  operations,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  input: ImportDropInput
  operations: FileSystemItemImportOperations
}): Promise<ImportDropResult> {
  const state = createImportDropState(input)

  for (const file of input.files) {
    await importDroppedFile({ catalog, file, input, operations, parentId: input.parentId, state })
  }

  for (const folder of input.rootFolders) {
    await importDroppedFolder({
      catalog,
      folder,
      input,
      operations,
      parentId: input.parentId,
      state,
    })
  }

  return {
    processedFiles: state.progress.processedFiles,
    processedFolders: state.progress.processedFolders,
    skippedFiles: state.progress.skippedFiles,
    lastFolderId: state.lastFolderId,
    skippedFileDetails: state.skippedFileDetails,
  }
}

function createImportDropState(input: ImportDropInput) {
  const progress: ImportDropProgress = {
    processedFiles: 0,
    processedFolders: 0,
    skippedFiles: 0,
  }
  const state = {
    lastFolderId: null as SidebarItemId | null,
    progress,
    siblingNamesByParent: new Map<SidebarItemId | null, Array<string>>(),
    skippedFileDetails: [] as Array<ImportDropSkippedFile>,
  }
  notifyProgress(input, state.progress)
  return state
}

async function importDroppedFolder({
  catalog,
  folder,
  input,
  operations,
  parentId,
  state,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  folder: ImportFolderEntry
  input: ImportDropInput
  operations: FileSystemItemImportOperations
  parentId: SidebarItemId | null
  state: ReturnType<typeof createImportDropState>
}): Promise<void> {
  const folderName = deduplicateName(
    folder.name,
    getImportDropSiblingNames({ catalog, parentId, state }),
  )
  let result: Awaited<ReturnType<FileSystemItemCreateOperations['createItem']>>
  try {
    result = await operations.createItem({
      type: RESOURCE_TYPES.folders,
      name: folderName,
      parentTarget: { kind: 'direct', parentId },
    })
  } catch (error) {
    skipImportEntry({
      error,
      fileName: folderName,
      input,
      reason: 'failed',
      skippedItemCount: countImportFolderItems(folder),
      state,
    })
    return
  }
  if (result.status !== 'completed') {
    skipImportEntry({
      error: result.status === 'failed' ? result.error : undefined,
      fileName: folderName,
      input,
      reason: result.status === 'unavailable' ? 'unavailable' : 'failed',
      skippedItemCount: countImportFolderItems(folder),
      state,
    })
    return
  }

  reserveImportDropSiblingName({ parentId, state, name: folderName })
  state.lastFolderId = result.id
  state.progress.processedFolders++
  notifyProgress(input, state.progress)

  for (const file of folder.files) {
    await importDroppedFile({ catalog, file, input, operations, parentId: result.id, state })
  }

  for (const subfolder of folder.subfolders) {
    await importDroppedFolder({
      catalog,
      folder: subfolder,
      input,
      operations,
      parentId: result.id,
      state,
    })
  }
}

async function importDroppedFile({
  catalog,
  file,
  input,
  operations,
  parentId,
  state,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  file: ImportFileEntry
  input: ImportDropInput
  operations: FileSystemItemImportOperations
  parentId: SidebarItemId | null
  state: ReturnType<typeof createImportDropState>
}) {
  let fileName = file.file.name
  try {
    const result = await operations.importFile({
      file: file.file,
      parentId,
      onProgress: (event) => input.onFileProgress?.(event),
    })
    fileName = result.fileName
    if (result.status === 'skipped') {
      skipImportEntry({
        error: result.error,
        fileName: result.fileName,
        input,
        reason: result.reason,
        state,
      })
      return
    }
    state.progress.processedFiles++
    getImportDropSiblingNames({ catalog, parentId, state })
    reserveImportDropSiblingName({ parentId, state, name: result.fileName })
    notifyProgress(input, state.progress)
  } catch (error) {
    skipImportEntry({ error, fileName, input, reason: 'failed', state })
  }
}

function getImportDropSiblingNames({
  catalog,
  parentId,
  state,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  parentId: SidebarItemId | null
  state: ReturnType<typeof createImportDropState>
}) {
  const names = state.siblingNamesByParent.get(parentId)
  if (names) return names
  const catalogNames = catalog.getVisibleChildren(parentId).map((sibling) => sibling.name)
  state.siblingNamesByParent.set(parentId, catalogNames)
  return catalogNames
}

function reserveImportDropSiblingName({
  name,
  parentId,
  state,
}: {
  name: string
  parentId: SidebarItemId | null
  state: ReturnType<typeof createImportDropState>
}) {
  const names = state.siblingNamesByParent.get(parentId)
  if (names) {
    names.push(name)
    return
  }
  state.siblingNamesByParent.set(parentId, [name])
}

function countImportFolderItems(folder: ImportFolderEntry): number {
  let count = 1 + folder.files.length
  for (const subfolder of folder.subfolders) {
    count += countImportFolderItems(subfolder)
  }
  return count
}

function skipImportEntry({
  error,
  fileName,
  input,
  reason,
  skippedItemCount = 1,
  state,
}: {
  error?: unknown
  fileName: string
  input: ImportDropInput
  reason: ImportDropSkippedFile['reason']
  skippedItemCount?: number
  state: ReturnType<typeof createImportDropState>
}) {
  state.progress.skippedFiles += skippedItemCount
  state.skippedFileDetails.push({
    fileName,
    reason,
    ...(error === undefined ? {} : { error }),
  })
  notifyProgress(input, state.progress)
}

function notifyProgress(input: ImportDropInput, progress: ImportDropProgress) {
  input.onProgress?.({ ...progress })
}
