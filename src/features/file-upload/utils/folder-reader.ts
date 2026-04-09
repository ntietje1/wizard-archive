/**
 * Utilities for reading folder contents from drag and drop operations.
 * Uses the File System Access API (webkitGetAsEntry) for recursive folder traversal.
 */

export interface FileWithPath {
  file: File
  relativePath: string
}

export interface FolderStructure {
  name: string
  relativePath: string
  files: Array<FileWithPath>
  subfolders: Array<FolderStructure>
}

export interface DropResult {
  files: Array<FileWithPath>
  rootFolders: Array<FolderStructure>
}

/**
 * Read all entries from a directory reader (handles batching)
 */
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

/**
 * Convert a FileSystemFileEntry to a File object
 */
function fileEntryToFile(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject)
  })
}

/**
 * Recursively read a directory and build a FolderStructure
 */
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
      const subFolder = await readDirectoryRecursively(
        entry as FileSystemDirectoryEntry,
        relativePath,
      )
      folder.subfolders.push(subFolder)
    }
  }

  return folder
}

/**
 * Process DataTransferItems to extract files and folder structures.
 * Handles both individual files and folders, preserving the hierarchy.
 */
export async function processDataTransferItems(
  items: DataTransferItemList | ReadonlyArray<DataTransferItem>,
): Promise<DropResult> {
  const result: DropResult = {
    files: [],
    rootFolders: [],
  }

  const entries: Array<FileSystemEntry> = []

  // Collect all entries first (must be done synchronously before async operations)
  for (const item of items) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry()
    if (entry) {
      entries.push(entry)
    }
  }

  // Process entries
  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await fileEntryToFile(fileEntry)
      result.files.push({
        file,
        relativePath: entry.name,
      })
    } else if (entry.isDirectory) {
      const folder = await readDirectoryRecursively(entry as FileSystemDirectoryEntry)
      result.rootFolders.push(folder)
    }
  }

  return result
}

/**
 * Count total files in a folder structure (including nested)
 */
export function countFilesInFolderStructure(folder: FolderStructure): number {
  let count = folder.files.length
  for (const subfolder of folder.subfolders) {
    count += countFilesInFolderStructure(subfolder)
  }
  return count
}

/**
 * Count total folders in a folder structure (including the folder itself)
 */
export function countFoldersInStructure(folder: FolderStructure): number {
  let count = 1 // Count this folder
  for (const subfolder of folder.subfolders) {
    count += countFoldersInStructure(subfolder)
  }
  return count
}

/**
 * Get total counts for a DropResult
 */
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
