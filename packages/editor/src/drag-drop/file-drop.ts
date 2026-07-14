import type { ResourceId } from '../resources/domain-id'
interface FileWithPath {
  file: File
  relativePath: string
}

interface FolderStructure {
  name: string
  relativePath: string
  files: Array<FileWithPath>
  subfolders: Array<FolderStructure>
}

export interface DropResult {
  files: Array<FileWithPath>
  rootFolders: Array<FolderStructure>
}

export type FileDropDestination =
  | { kind: 'direct'; parentId: ResourceId | null }
  | { kind: 'assets' }

export interface FileDropOptions {
  destination: FileDropDestination
}

export type FileDropHandleResult =
  | { status: 'completed'; receipt: unknown }
  | { status: 'unsupported'; reason: 'external_file_drops_disabled' }

type FileDropHandler = (
  dropResult: DropResult,
  options?: FileDropOptions,
) => Promise<FileDropHandleResult>

export type DndExternalFileDropCapability =
  | { status: 'disabled'; handleDropFiles: FileDropHandler }
  | {
      status: 'enabled'
      handleDropFiles: FileDropHandler
    }

export interface DndExternalFileDropContext {
  handleDropFiles: FileDropHandler
  runtimeId?: string
}

export function createDisabledExternalFileDropCapability(): Extract<
  DndExternalFileDropCapability,
  { status: 'disabled' }
> {
  return {
    status: 'disabled',
    handleDropFiles: rejectDisabledExternalFileDrop,
  }
}

function rejectDisabledExternalFileDrop(): Promise<FileDropHandleResult> {
  return Promise.resolve({ status: 'unsupported', reason: 'external_file_drops_disabled' })
}

async function readAllDirectoryEntries(
  directoryReader: FileSystemDirectoryReader,
): Promise<Array<FileSystemEntry>> {
  const entries: Array<FileSystemEntry> = []

  const readBatch = (): Promise<Array<FileSystemEntry>> => {
    return new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject)
    })
  }

  // readEntries returns results in batches, must keep calling until empty
  let batch: Array<FileSystemEntry>
  do {
    batch = await readBatch()
    entries.push(...batch)
  } while (batch.length > 0)

  return entries
}

function fileEntryToFile(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject)
  })
}

async function readDirectoryRecursively(
  directoryEntry: FileSystemDirectoryEntry,
  parentPath: string = '',
): Promise<FolderStructure> {
  const relativePath = parentPath ? `${parentPath}/${directoryEntry.name}` : directoryEntry.name

  const folder: FolderStructure = {
    name: directoryEntry.name,
    relativePath,
    files: [],
    subfolders: [],
  }

  const entries = await readAllDirectoryEntries(directoryEntry.createReader())
  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await fileEntryToFile(fileEntry)
      folder.files.push({
        file,
        relativePath: `${relativePath}/${entry.name}`,
      })
    } else if (entry.isDirectory) {
      folder.subfolders.push(
        await readDirectoryRecursively(entry as FileSystemDirectoryEntry, relativePath),
      )
    }
  }

  return folder
}

export async function processDataTransferItems(
  items: DataTransferItemList | ReadonlyArray<DataTransferItem>,
): Promise<DropResult> {
  const result: DropResult = {
    files: [],
    rootFolders: [],
  }

  const itemSnapshot = Array.from(items).flatMap(snapshotDataTransferItem)

  for (const item of itemSnapshot) {
    await appendDataTransferItem(result, item)
  }

  return result
}

type DataTransferItemSnapshot = { entry: FileSystemEntry } | { file: File }

function snapshotDataTransferItem(item: DataTransferItem): Array<DataTransferItemSnapshot> {
  if (item.kind !== 'file') return []
  const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
  if (entry) return [{ entry }]
  const file = item.getAsFile()
  return file ? [{ file }] : []
}

async function appendDataTransferItem(result: DropResult, item: DataTransferItemSnapshot) {
  if ('entry' in item) {
    await appendFileSystemEntry(result, item.entry)
    return
  }

  result.files.push({
    file: item.file,
    relativePath: item.file.name,
  })
}

async function appendFileSystemEntry(result: DropResult, entry: FileSystemEntry) {
  if (entry.isFile) {
    await appendFileEntry(result, entry as FileSystemFileEntry)
    return
  }
  if (entry.isDirectory) {
    await appendDirectoryEntry(result, entry as FileSystemDirectoryEntry)
  }
}

async function appendFileEntry(result: DropResult, entry: FileSystemFileEntry) {
  const file = await fileEntryToFile(entry)
  result.files.push({
    file,
    relativePath: entry.name,
  })
}

async function appendDirectoryEntry(result: DropResult, entry: FileSystemDirectoryEntry) {
  const folder = await readDirectoryRecursively(entry)
  result.rootFolders.push(folder)
}

function countFilesInFolderStructure(folder: FolderStructure): number {
  let count = folder.files.length
  for (const subfolder of folder.subfolders) {
    count += countFilesInFolderStructure(subfolder)
  }
  return count
}

function countFoldersInStructure(folder: FolderStructure): number {
  let count = 1
  for (const subfolder of folder.subfolders) {
    count += countFoldersInStructure(subfolder)
  }
  return count
}

export function getDropResultStats(result: DropResult): {
  totalFiles: number
  totalFolders: number
} {
  let totalFiles = result.files.length
  let totalFolders = 0

  for (const folder of result.rootFolders) {
    totalFiles += countFilesInFolderStructure(folder)
    totalFolders += countFoldersInStructure(folder)
  }

  return { totalFiles, totalFolders }
}
