import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createEmptyNoteYDoc } from '../../notes/document/headless-yjs'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type {
  CommandDelivery,
  ResourceStructureCommand,
  ResourceStructureCommandResult,
} from '../resource-command-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceKind } from '../resource-record'
import type { ResourceUndoHistory } from '../resource-undo-history'
import { EMPTY_WORKSPACE_CLIPBOARD } from '../workspace-clipboard'
import type { WorkspaceClipboard } from '../workspace-clipboard'
import { validateFileUploadSize } from '../../../../../shared/storage/validation'
import type {
  PlainTransferExecutionResult,
  PlainTransferEntryOutcome,
  PlainTransferInputEntry,
  PlainTransferIntent,
  PlainTransferProgress,
  PlainTransferSourceDescriptor,
} from '../transfer-job-contract'
import { readBrowserPlainTransfer } from './browser-plain-transfer'
import type { BrowserPlainTransferData } from './browser-plain-transfer'

export type WorkspaceReport = (
  message: string,
  retry?: () => void,
  progress?: PlainTransferProgress,
) => void

export type WorkspaceCreationSettlement =
  | Readonly<{ status: 'completed'; resourceId: ResourceId }>
  | Readonly<{
      status: 'indeterminate'
      reason:
        | Extract<CommandDelivery<never>, { status: 'indeterminate' }>['reason']
        | 'transport_unavailable'
      retry: () => Promise<WorkspaceCreationSettlement>
    }>
  | Readonly<{
      status: 'failed'
      reason: string
      retry: (() => Promise<WorkspaceCreationSettlement>) | null
    }>
  | Readonly<{ status: 'cancelled' }>
  | Readonly<{ status: 'rejected'; reason: string }>

const MAX_EMPTY_TRASH_ROOTS_PER_COMMAND = 25

export function createWorkspaceActions(runtime: EditorRuntime, report: WorkspaceReport) {
  return {
    bookmark: (resourceIds: ReadonlyArray<ResourceId>, bookmarked: boolean) =>
      setWorkspaceBookmarkState(runtime, resourceIds, bookmarked, report),
    changeLifecycle: (
      resourceIds: ReadonlyArray<ResourceId>,
      type: 'permanentlyDelete' | 'restore' | 'trash',
    ) => changeWorkspaceResourcesLifecycle(runtime, resourceIds, type, report),
    copyId: (resource: AuthorizedResourceSummary) => copyWorkspaceResourceId(resource, report),
    copyLink: (resource: AuthorizedResourceSummary) =>
      copyWorkspaceResourceLink(runtime, resource, report),
    create: (
      kind: Exclude<ResourceKind, 'file'>,
      parentId: ResourceId | null,
      title: string,
      signal?: AbortSignal,
    ) => createWorkspaceResource(runtime, kind, parentId, title, report, signal),
    createFile: (parentId: ResourceId | null, file: File, signal?: AbortSignal) =>
      createWorkspaceFile(runtime, parentId, file, report, signal),
    createAssetFile: (file: File, signal?: AbortSignal) =>
      createWorkspaceAssetFile(runtime, file, report, signal),
    download: (resource: AuthorizedResourceSummary) =>
      downloadWorkspaceResource(runtime, resource, report),
    duplicate: (resourceIds: ReadonlyArray<ResourceId>, destinationParentId: ResourceId | null) =>
      duplicateWorkspaceResources(runtime, resourceIds, destinationParentId, report),
    emptyTrash: (resourceIds: ReadonlyArray<ResourceId>) =>
      emptyWorkspaceTrash(runtime, resourceIds, report),
    importExternal: (
      destinationParentId: ResourceId | null,
      dataTransfer: BrowserPlainTransferData,
    ) => importWorkspaceDataTransfer(runtime, destinationParentId, dataTransfer, report),
    move: (resourceIds: ReadonlyArray<ResourceId>, destinationParentId: ResourceId | null) =>
      moveWorkspaceResources(runtime, resourceIds, destinationParentId, report),
    open: (resourceId: ResourceId) => runtime.navigation.open({ kind: 'resource', resourceId }),
    paste: (clipboard: WorkspaceClipboard, destinationParentId: ResourceId) =>
      pasteWorkspaceClipboard(runtime, clipboard, destinationParentId, report),
    report,
    update: (resourceId: ResourceId, values: { title: string; icon: string; color: string }) =>
      updateWorkspaceResource(runtime, resourceId, values, report),
    undo: (direction: 'redo' | 'undo') => {
      const history = runtime.resources.undo
      if (history.status !== 'available') {
        report(`${direction === 'undo' ? 'Undo' : 'Redo'} is unavailable`)
        return Promise.resolve()
      }
      return runResourceUndo(history.value, direction, report)
    },
  }
}

export type WorkspaceActions = Readonly<ReturnType<typeof createWorkspaceActions>>

async function createWorkspaceResource(
  runtime: EditorRuntime,
  kind: Exclude<ResourceKind, 'file'>,
  parentId: ResourceId | null,
  title: string,
  report: WorkspaceReport,
  signal?: AbortSignal,
) {
  if (signal?.aborted) return { status: 'cancelled' } as const
  const structure = runtime.resources.structure
  if (structure.status !== 'available') {
    return { status: 'rejected', reason: 'read_only' } as const
  }
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  let canonicalTitle
  try {
    canonicalTitle = canonicalizeResourceTitle(title || `Untitled ${kind}`)
  } catch {
    return { status: 'rejected', reason: 'invalid_title' } as const
  }
  const command = {
    type: 'create' as const,
    resourceId,
    kind,
    parentId,
    title: canonicalTitle,
    icon: null,
    color: null,
  }
  const envelope = { campaignId: runtime.scope.campaignId, operationId, command }
  const noteDocument = kind === 'note' ? createEmptyNoteYDoc() : null
  const deliver = () => {
    switch (kind) {
      case 'folder':
        return structure.value.execute(envelope)
      case 'note': {
        if (!noteDocument) throw new TypeError('Note creation document is unavailable')
        return runtime.content.notes.create(
          { ...envelope, command: { ...command, kind: 'note' } },
          noteDocument,
        )
      }
      case 'map':
        return runtime.content.maps.create({
          ...envelope,
          command: { ...command, kind: 'map' },
        })
      case 'canvas':
        return runtime.content.canvases.create({
          ...envelope,
          command: { ...command, kind: 'canvas' },
        })
    }
  }
  return await completeWorkspaceCreation(
    { state: 'expected', resourceId },
    deliver,
    `${resourceKindLabel(kind)} created`,
    report,
    signal,
  )
}

async function createWorkspaceFile(
  runtime: EditorRuntime,
  parentId: ResourceId | null,
  file: File,
  report: WorkspaceReport,
  signal?: AbortSignal,
) {
  if (signal?.aborted) return { status: 'cancelled' } as const
  if (runtime.resources.structure.status !== 'available') {
    return { status: 'rejected', reason: 'read_only' } as const
  }
  if (runtime.transfers.status !== 'available') {
    return { status: 'rejected', reason: runtime.transfers.reason } as const
  }
  const validation = validateFileUploadSize(file.size)
  if (!validation.valid) {
    return { status: 'rejected', reason: validation.error } as const
  }
  const jobId = generateDomainId(DOMAIN_ID_KIND.importJob)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    if (signal?.aborted) return { status: 'cancelled' } as const
    return { status: 'rejected', reason: 'file_read_failed' } as const
  }
  if (signal?.aborted) return { status: 'cancelled' } as const
  const intent = {
    campaignId: runtime.scope.campaignId,
    jobId,
    operationId,
    destinationParentId: parentId,
    textFileHandling: 'files' as const,
  }
  const sourceId = 'selected-file'
  const deliver = createWorkspaceTransferDelivery(
    runtime,
    intent,
    [{ id: sourceId, kind: 'file', name: file.name }],
    [{ sourceId, path: file.name, type: 'file', bytes }],
  )
  return await completeWorkspaceTransfer(deliver, report, signal)
}

async function importWorkspaceDataTransfer(
  runtime: EditorRuntime,
  destinationParentId: ResourceId | null,
  dataTransfer: BrowserPlainTransferData,
  report: WorkspaceReport,
): Promise<void> {
  if (
    runtime.resources.structure.status !== 'available' ||
    runtime.transfers.status !== 'available'
  ) {
    report('Files cannot be imported in this workspace')
    return
  }
  report('Reading dropped files…')
  let transfer
  try {
    transfer = await readBrowserPlainTransfer(dataTransfer)
  } catch {
    report('Could not read the dropped files')
    return
  }
  if (transfer.sources.length === 0) {
    report('No files were found in the drop')
    return
  }
  const deliver = createWorkspaceTransferDelivery(
    runtime,
    {
      campaignId: runtime.scope.campaignId,
      jobId: generateDomainId(DOMAIN_ID_KIND.importJob),
      destinationParentId,
      textFileHandling: 'notes',
    },
    transfer.sources,
    transfer.entries,
  )
  await settleWorkspaceDropTransfer(runtime, deliver, report)
}

type WorkspaceTransferDelivery = (
  signal?: AbortSignal,
  onProgress?: (progress: PlainTransferProgress) => void,
) => Promise<PlainTransferExecutionResult>

function createWorkspaceTransferDelivery(
  runtime: EditorRuntime,
  intent: PlainTransferIntent,
  sources: ReadonlyArray<PlainTransferSourceDescriptor>,
  entries: ReadonlyArray<PlainTransferInputEntry>,
): WorkspaceTransferDelivery {
  return (signal, onProgress) =>
    runtime.transfers.status === 'available'
      ? runtime.transfers.value.execute(
          intent,
          sources,
          entries,
          signal || onProgress
            ? {
                ...(signal ? { signal } : {}),
                ...(onProgress ? { onProgress } : {}),
              }
            : undefined,
        )
      : Promise.resolve({ status: 'rejected', reason: runtime.transfers.reason })
}

async function settleWorkspaceDropTransfer(
  runtime: EditorRuntime,
  deliver: WorkspaceTransferDelivery,
  report: WorkspaceReport,
): Promise<void> {
  let result: PlainTransferExecutionResult
  try {
    result = await deliver(undefined, (progress) => {
      const current = progress.currentPath ? `: ${progress.currentPath}` : ''
      report(`Importing resources${current}`, undefined, progress)
    })
  } catch {
    report('Import failed', () => void settleWorkspaceDropTransfer(runtime, deliver, report))
    return
  }
  if (result.status === 'indeterminate') {
    report(
      `Import status is unresolved: ${result.reason}`,
      () => void settleWorkspaceDropTransfer(runtime, deliver, report),
    )
    return
  }
  if (result.status === 'rejected') {
    report(`Import rejected: ${result.reason}`)
    return
  }
  if (result.status !== 'settled') {
    report(
      'Import status is unresolved',
      () => void settleWorkspaceDropTransfer(runtime, deliver, report),
    )
    return
  }
  if (result.entries.every((entry) => entry.status === 'cancelled')) {
    report('Import cancelled')
    return
  }
  const completed = result.entries.filter((entry) => entry.status === 'completed')
  const rejected = result.entries.filter((entry) => entry.status === 'rejected')
  report(workspaceTransferSummary(completed, rejected))
  const opened = completed.find((entry) => entry.kind === 'folder') ?? completed[0]
  if (opened) runtime.navigation.open({ kind: 'resource', resourceId: opened.resourceId })
}

function workspaceTransferSummary(
  completed: ReadonlyArray<Extract<PlainTransferEntryOutcome, { status: 'completed' }>>,
  rejected: ReadonlyArray<Extract<PlainTransferEntryOutcome, { status: 'rejected' }>>,
): string {
  const folders = completed.filter((entry) => entry.kind === 'folder').length
  const notes = completed.filter((entry) => entry.kind === 'note').length
  const files = completed.length - folders - notes
  const imported = [
    folders > 0 ? `${folders} folder${folders === 1 ? '' : 's'}` : '',
    notes > 0 ? `${notes} note${notes === 1 ? '' : 's'}` : '',
    files > 0 ? `${files} file${files === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(', ')
  if (!imported && rejected.length === 0) return 'Nothing was imported'
  if (rejected.length === 0) return `Imported ${imported}`
  const reasons = rejected
    .slice(0, 3)
    .map((entry) => `${entry.sourcePath}: ${entry.reason}`)
    .join('; ')
  return `${imported ? `Imported ${imported}. ` : ''}${rejected.length} skipped: ${reasons}`
}

async function createWorkspaceAssetFile(
  runtime: EditorRuntime,
  file: File,
  report: WorkspaceReport,
  signal?: AbortSignal,
): Promise<WorkspaceCreationSettlement> {
  if (signal?.aborted) return { status: 'cancelled' }
  if (runtime.resources.structure.status !== 'available') {
    return { status: 'rejected', reason: 'read_only' }
  }
  const validation = validateFileUploadSize(file.size)
  if (!validation.valid) return { status: 'rejected', reason: validation.error }
  let bytes
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    if (signal?.aborted) return { status: 'cancelled' }
    return { status: 'rejected', reason: 'file_read_failed' }
  }
  if (signal?.aborted) return { status: 'cancelled' }
  return await settleAssetFileCreation(
    await runtime.content.files.createAsset({ bytes, fileName: file.name }),
    report,
    signal,
  )
}

function settleAssetFileCreation(
  result: Awaited<ReturnType<EditorRuntime['content']['files']['createAsset']>>,
  report: WorkspaceReport,
  signal?: AbortSignal,
): Promise<WorkspaceCreationSettlement> {
  if (signal?.aborted) return Promise.resolve({ status: 'cancelled' })
  if (result.status === 'completed') {
    report('File uploaded')
    return Promise.resolve(result)
  }
  if (result.status === 'retryable') {
    return Promise.resolve({
      status: 'indeterminate',
      reason: result.reason,
      retry: async () => await settleAssetFileCreation(await result.retry(), report),
    })
  }
  return Promise.resolve({ status: 'rejected', reason: result.reason })
}

async function downloadWorkspaceResource(
  runtime: EditorRuntime,
  resource: AuthorizedResourceSummary,
  report: WorkspaceReport,
): Promise<void> {
  if (resource.kind === 'folder') {
    report('Folders cannot be downloaded directly')
    return
  }
  const retry = () => void downloadWorkspaceResource(runtime, resource, report)
  try {
    const source = runtime.content[contentSourceName(resource.kind)]
    const result = await source.export(resource.id)
    if (result.status !== 'ready') {
      report(
        result.status === 'loading' ? 'Content is still loading' : 'Content is unavailable',
        retry,
      )
      return
    }
    const link = document.createElement('a')
    const url = URL.createObjectURL(
      new Blob([Uint8Array.from(result.bytes).buffer], { type: result.mediaType }),
    )
    link.href = url
    link.download = resourceDownloadFileName(resource.title, result.extension)
    link.click()
    URL.revokeObjectURL(url)
    report('Download started')
  } catch {
    report('Download failed', retry)
  }
}

function contentSourceName(kind: Exclude<ResourceKind, 'folder'>) {
  switch (kind) {
    case 'note':
      return 'notes' as const
    case 'file':
      return 'files' as const
    case 'map':
      return 'maps' as const
    case 'canvas':
      return 'canvases' as const
  }
}

function resourceDownloadFileName(title: string, extension: string): string {
  const safeTitle = Array.from(title)
    .map((character) => {
      const codePoint = character.codePointAt(0)!
      return codePoint <= 31 || '<>:"/\\|?*'.includes(character) ? '_' : character
    })
    .join('')
    .replace(/[. ]+$/g, '')
    .trim()
  const base = safeTitle || 'Untitled'
  return base.toLocaleLowerCase().endsWith(`.${extension.toLocaleLowerCase()}`)
    ? base
    : `${base}.${extension}`
}

async function completeWorkspaceCreation(
  expectation:
    | Readonly<{ state: 'authoritative' }>
    | Readonly<{ state: 'expected'; resourceId: ResourceId }>,
  deliver: (signal?: AbortSignal) => Promise<CommandDelivery<ResourceStructureCommandResult>>,
  successMessage: string,
  report: WorkspaceReport,
  signal?: AbortSignal,
): Promise<WorkspaceCreationSettlement> {
  if (signal?.aborted) return { status: 'cancelled' }
  let delivery: CommandDelivery<ResourceStructureCommandResult>
  try {
    delivery = await deliver(signal)
  } catch {
    const retry = () => completeWorkspaceCreation(expectation, deliver, successMessage, report)
    return { status: 'failed', reason: 'provider_failure', retry }
  }
  if (delivery.status === 'indeterminate') {
    const retry = () => completeWorkspaceCreation(expectation, deliver, successMessage, report)
    return { status: 'indeterminate', reason: delivery.reason, retry }
  }
  if (delivery.status === 'not_committed') {
    const retry = delivery.retryable
      ? () => completeWorkspaceCreation(expectation, deliver, successMessage, report)
      : null
    return { status: 'failed', reason: delivery.reason, retry }
  }
  if (delivery.result.status === 'completed') {
    const result = delivery.result.receipt.result
    if (
      result.type !== 'created' ||
      (expectation.state === 'expected' && result.resourceId !== expectation.resourceId)
    ) {
      return { status: 'failed', reason: 'invalid_response', retry: null }
    }
    report(successMessage)
    return { status: 'completed', resourceId: result.resourceId }
  }
  report(deliveryMessage(delivery))
  return { status: 'rejected', reason: delivery.result.reason }
}

async function completeWorkspaceTransfer(
  deliver: (
    signal?: AbortSignal,
  ) => ReturnType<Extract<EditorRuntime['transfers'], { status: 'available' }>['value']['execute']>,
  report: WorkspaceReport,
  signal?: AbortSignal,
): Promise<WorkspaceCreationSettlement> {
  if (signal?.aborted) return { status: 'cancelled' }
  let result
  try {
    result = await deliver(signal)
  } catch {
    return {
      status: 'failed',
      reason: 'provider_failure',
      retry: () => completeWorkspaceTransfer(deliver, report),
    }
  }
  if (result.status === 'indeterminate') {
    return {
      status: 'indeterminate',
      reason: result.reason,
      retry: () => completeWorkspaceTransfer(deliver, report),
    }
  }
  if (result.status === 'rejected') {
    return { status: 'rejected', reason: result.reason }
  }
  if (result.status !== 'settled') {
    return {
      status: 'indeterminate',
      reason: 'response_lost',
      retry: () => completeWorkspaceTransfer(deliver, report),
    }
  }
  if (result.entries.every((entry) => entry.status === 'cancelled')) {
    return { status: 'cancelled' }
  }
  const completed = result.entries.filter((entry) => entry.status === 'completed')
  const rejected = result.entries.filter((entry) => entry.status === 'rejected')
  const created = completed[0]
  if (completed.length !== 1 || rejected.length !== 0 || !created) {
    return {
      status: 'failed',
      reason: rejected[0]?.reason ?? 'invalid_response',
      retry: null,
    }
  }
  report(created.kind === 'note' ? 'Note imported' : 'File uploaded')
  return { status: 'completed', resourceId: created.resourceId }
}

async function updateWorkspaceResource(
  runtime: EditorRuntime,
  resourceId: ResourceId,
  values: { title: string; icon: string; color: string },
  report: WorkspaceReport,
) {
  let title
  try {
    title = canonicalizeResourceTitle(values.title)
  } catch {
    report('Invalid resource title')
    return false
  }
  return await executeWorkspaceStructureCommand(
    runtime,
    {
      type: 'updateMetadata',
      resourceId,
      changes: { title, icon: values.icon || null, color: values.color || null },
    },
    report,
  )
}

async function moveWorkspaceResources(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  destinationParentId: ResourceId | null,
  report: WorkspaceReport,
) {
  return await executeWorkspaceStructureCommand(
    runtime,
    { type: 'move', resourceIds, destinationParentId },
    report,
  )
}

async function changeWorkspaceResourcesLifecycle(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  type: 'permanentlyDelete' | 'restore' | 'trash',
  report: WorkspaceReport,
) {
  return await executeWorkspaceStructureCommand(
    runtime,
    { type, resourceIds },
    report,
    (delivery) => {
      clearDeletedTarget(runtime, delivery)
      report(deliveryMessage(delivery))
    },
  )
}

async function emptyWorkspaceTrash(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  report: WorkspaceReport,
): Promise<void> {
  const structure = runtime.resources.structure
  if (structure.status !== 'available') {
    report('This workspace is read only')
    return
  }
  const batches = Array.from(
    { length: Math.ceil(resourceIds.length / MAX_EMPTY_TRASH_ROOTS_PER_COMMAND) },
    (_, index) =>
      resourceIds.slice(
        index * MAX_EMPTY_TRASH_ROOTS_PER_COMMAND,
        (index + 1) * MAX_EMPTY_TRASH_ROOTS_PER_COMMAND,
      ),
  )
  const run = async (batchIndex: number, batchOperationId: ReturnType<typeof newOperationId>) => {
    const batch = batches[batchIndex]
    if (!batch) {
      report('Trash emptied')
      return
    }
    const delivery = await structure.value.execute({
      campaignId: runtime.scope.campaignId,
      operationId: batchOperationId,
      command: { type: 'permanentlyDelete', resourceIds: batch },
    })
    const completed = Math.min(batchIndex * MAX_EMPTY_TRASH_ROOTS_PER_COMMAND, resourceIds.length)
    if (delivery.status === 'indeterminate') {
      report(
        `Deleted ${completed} of ${resourceIds.length}; delivery is uncertain`,
        () => void run(batchIndex, batchOperationId),
      )
      return
    }
    if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
      report(`Deleted ${completed} of ${resourceIds.length}; ${deliveryMessage(delivery)}`)
      return
    }
    clearDeletedTarget(runtime, delivery)
    await run(batchIndex + 1, newOperationId())
  }
  await run(0, newOperationId())
}

function clearDeletedTarget(
  runtime: EditorRuntime,
  delivery: CommandDelivery<ResourceStructureCommandResult>,
) {
  if (
    delivery.status !== 'received' ||
    delivery.result.status !== 'completed' ||
    delivery.result.receipt.result.type !== 'permanentlyDeleted'
  ) {
    return
  }
  const target = runtime.navigation.current()
  if (target && delivery.result.receipt.result.resourceIds.includes(target.resourceId)) {
    runtime.navigation.open(null)
  }
}

function newOperationId() {
  return generateDomainId(DOMAIN_ID_KIND.operation)
}

async function duplicateWorkspaceResources(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  destinationParentId: ResourceId | null,
  report: WorkspaceReport,
) {
  return await executeWorkspaceStructureCommand(
    runtime,
    {
      type: 'deepCopy',
      sourceRootIds: resourceIds,
      destinationParentId,
    },
    report,
    (delivery) => {
      if (
        delivery.status === 'received' &&
        delivery.result.status === 'completed' &&
        delivery.result.receipt.result.type === 'deepCopied'
      ) {
        const roots = delivery.result.receipt.result.roots
        if (roots.length === 1 && roots[0]) {
          runtime.navigation.open({
            kind: 'resource',
            resourceId: roots[0].destinationRootId,
          })
        }
        report(roots.length === 1 ? 'Resource duplicated' : `${roots.length} resources duplicated`)
        return
      }
      report(deliveryMessage(delivery))
    },
  )
}

async function pasteWorkspaceClipboard(
  runtime: EditorRuntime,
  clipboard: WorkspaceClipboard,
  destinationParentId: ResourceId,
  report: WorkspaceReport,
): Promise<WorkspaceClipboard> {
  if (clipboard.status === 'empty' || clipboard.resourceIds.includes(destinationParentId)) {
    return clipboard
  }
  const completed =
    clipboard.operation === 'copy'
      ? await duplicateWorkspaceResources(
          runtime,
          clipboard.resourceIds,
          destinationParentId,
          report,
        )
      : await moveWorkspaceResources(runtime, clipboard.resourceIds, destinationParentId, report)
  return completed && clipboard.operation === 'move' ? EMPTY_WORKSPACE_CLIPBOARD : clipboard
}

async function copyWorkspaceResourceLink(
  runtime: EditorRuntime,
  resource: AuthorizedResourceSummary,
  report: WorkspaceReport,
) {
  if (!globalThis.navigator?.clipboard) {
    report('Copy link is unavailable')
    return
  }
  const url = new URL(
    `/campaigns/${runtime.scope.campaignId}/editor?resource=${resource.id}`,
    globalThis.location?.origin ?? 'https://wizard-archive.invalid',
  )
  await navigator.clipboard.writeText(url.href)
  report('Link copied')
}

async function copyWorkspaceResourceId(
  resource: AuthorizedResourceSummary,
  report: WorkspaceReport,
) {
  if (!globalThis.navigator?.clipboard) {
    report('Copy resource ID is unavailable')
    return
  }
  await navigator.clipboard.writeText(resource.id)
  report('Resource ID copied')
}

async function setWorkspaceBookmarkState(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  bookmarked: boolean,
  report: WorkspaceReport,
) {
  const bookmarks = runtime.resources.bookmarks
  if (bookmarks.status !== 'available') {
    report('Bookmarks are unavailable')
    return false
  }
  try {
    const result = await bookmarks.value.setBookmarkState(resourceIds, bookmarked)
    if (result.status !== 'completed') {
      report(`rejected: ${result.reason}`)
      return false
    }
    report(bookmarked ? 'Bookmarked' : 'Bookmark removed')
    return true
  } catch {
    report(
      'Bookmark update failed. Retry safely.',
      () => void setWorkspaceBookmarkState(runtime, resourceIds, bookmarked, report),
    )
    return false
  }
}

async function runResourceUndo(
  history: ResourceUndoHistory,
  direction: 'undo' | 'redo',
  report: WorkspaceReport,
): Promise<void> {
  const run = () => (direction === 'undo' ? history.undo() : history.redo())
  const delivery = await run()
  if (delivery.status === 'received') {
    if (delivery.result.status === 'completed') return
    const label = direction === 'undo' ? 'Undo' : 'Redo'
    report(
      delivery.result.status === 'rejected' && delivery.result.reason === 'history_conflict'
        ? `${label} is no longer safe because the resource changed`
        : `${label} is unavailable`,
    )
    return
  }
  const retry = delivery.retryable
    ? () => void runResourceUndo(history, direction, report)
    : undefined
  report(
    delivery.status === 'indeterminate'
      ? `${direction === 'undo' ? 'Undo' : 'Redo'} status is unknown`
      : `${direction === 'undo' ? 'Undo' : 'Redo'} was not applied`,
    retry,
  )
}

async function executeWorkspaceStructureCommand(
  runtime: EditorRuntime,
  command: ResourceStructureCommand,
  report: WorkspaceReport,
  handle: (delivery: CommandDelivery<ResourceStructureCommandResult>) => void = (delivery) =>
    report(deliveryMessage(delivery)),
) {
  const structure = runtime.resources.structure
  if (structure.status !== 'available') {
    report('This workspace is read only')
    return false
  }
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const attempt = async (): Promise<boolean> => {
    const delivery = await structure.value.execute({
      campaignId: runtime.scope.campaignId,
      operationId,
      command,
    })
    if (delivery.status === 'indeterminate') {
      report(deliveryMessage(delivery), () => void attempt())
      return false
    }
    handle(delivery)
    return delivery.status === 'received' && delivery.result.status === 'completed'
  }
  return await attempt()
}

function deliveryMessage(delivery: CommandDelivery<ResourceStructureCommandResult>) {
  if (delivery.status === 'indeterminate') return 'Delivery is uncertain. Retry safely.'
  if (delivery.status === 'not_committed') return `Not committed: ${delivery.reason}`
  return delivery.result.status === 'completed'
    ? 'Completed'
    : `${delivery.result.status}: ${delivery.result.reason}`
}

export function resourceKindLabel(kind: ResourceKind) {
  return kind === 'map' ? 'Map' : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}
