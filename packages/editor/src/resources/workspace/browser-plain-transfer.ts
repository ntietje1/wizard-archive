import type {
  PlainTransferInputEntry,
  PlainTransferSourceDescriptor,
} from '../transfer-job-contract'

type BrowserPlainTransfer = Readonly<{
  sources: ReadonlyArray<PlainTransferSourceDescriptor>
  entries: ReadonlyArray<PlainTransferInputEntry>
}>

export type BrowserPlainTransferData = Readonly<{
  files: ArrayLike<File>
  items: ArrayLike<DataTransferItem>
}>

type BrowserTransferSnapshot =
  | Readonly<{ kind: 'entry'; entry: FileSystemEntry }>
  | Readonly<{ kind: 'file'; file: File }>

export function hasBrowserPlainTransfer(dataTransfer: Pick<DataTransfer, 'types'>): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

export async function readBrowserPlainTransfer(
  dataTransfer: BrowserPlainTransferData,
): Promise<BrowserPlainTransfer> {
  const snapshots = snapshotBrowserTransfer(dataTransfer)
  const roots = await Promise.all(
    snapshots.map((snapshot, index) => readBrowserTransferRoot(snapshot, `browser-${index + 1}`)),
  )
  return {
    sources: roots.map((root) => root.source),
    entries: roots.flatMap((root) => root.entries),
  }
}

function snapshotBrowserTransfer(
  dataTransfer: BrowserPlainTransferData,
): ReadonlyArray<BrowserTransferSnapshot> {
  const items = Array.from(dataTransfer.items).flatMap(snapshotBrowserTransferItem)
  return items.length > 0
    ? items
    : Array.from(dataTransfer.files, (file) => ({ kind: 'file' as const, file }))
}

function snapshotBrowserTransferItem(
  item: DataTransferItem,
): ReadonlyArray<BrowserTransferSnapshot> {
  if (item.kind !== 'file') return []
  const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
  if (entry) return [{ kind: 'entry', entry }]
  const file = item.getAsFile()
  return file ? [{ kind: 'file', file }] : []
}

async function readBrowserTransferRoot(
  snapshot: BrowserTransferSnapshot,
  sourceId: string,
): Promise<
  Readonly<{
    source: PlainTransferSourceDescriptor
    entries: ReadonlyArray<PlainTransferInputEntry>
  }>
> {
  if (snapshot.kind === 'file') {
    return {
      source: { id: sourceId, kind: 'file', name: snapshot.file.name },
      entries: [await readBrowserFile(sourceId, snapshot.file.name, snapshot.file)],
    }
  }
  if (snapshot.entry.isFile) {
    const entry = snapshot.entry as FileSystemFileEntry
    return {
      source: { id: sourceId, kind: 'file', name: entry.name },
      entries: [await readBrowserFile(sourceId, entry.name, await fileSystemEntryFile(entry))],
    }
  }
  const entry = snapshot.entry as FileSystemDirectoryEntry
  return {
    source: { id: sourceId, kind: 'directory', name: entry.name },
    entries: await readBrowserDirectoryRoot(sourceId, entry),
  }
}

async function readBrowserDirectoryRoot(
  sourceId: string,
  directory: FileSystemDirectoryEntry,
): Promise<ReadonlyArray<PlainTransferInputEntry>> {
  const children = await readAllDirectoryEntries(directory.createReader())
  const descendants = await Promise.all(
    children.map((entry) => readBrowserDirectoryEntry(sourceId, entry, '')),
  )
  return descendants.flat()
}

async function readBrowserDirectoryEntry(
  sourceId: string,
  entry: FileSystemEntry,
  parentPath: string,
): Promise<ReadonlyArray<PlainTransferInputEntry>> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name
  if (entry.isFile) {
    return [
      await readBrowserFile(sourceId, path, fileSystemEntryFile(entry as FileSystemFileEntry)),
    ]
  }
  const directory = entry as FileSystemDirectoryEntry
  const children = await readAllDirectoryEntries(directory.createReader())
  const descendants = await Promise.all(
    children.map((child) => readBrowserDirectoryEntry(sourceId, child, path)),
  )
  return [{ sourceId, path, type: 'directory' }, ...descendants.flat()]
}

async function readBrowserFile(
  sourceId: string,
  path: string,
  file: File | Promise<File>,
): Promise<PlainTransferInputEntry> {
  const resolved = await file
  return {
    sourceId,
    path,
    type: 'file',
    bytes: new Uint8Array(await resolved.arrayBuffer()),
  }
}

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<ReadonlyArray<FileSystemEntry>> {
  const entries: Array<FileSystemEntry> = []
  let batch = await readDirectoryBatch(reader)
  while (batch.length > 0) {
    entries.push(...batch)
    batch = await readDirectoryBatch(reader)
  }
  return entries
}

function readDirectoryBatch(
  reader: FileSystemDirectoryReader,
): Promise<ReadonlyArray<FileSystemEntry>> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject))
}

function fileSystemEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}
