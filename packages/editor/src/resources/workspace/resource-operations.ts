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
import { planWorkspaceResourceDrop } from '../workspace-resource-drop-plan'
import type {
  WorkspaceResourceDragPayload,
  WorkspaceResourceDropTarget,
} from '../workspace-resource-drop-plan'

export type WorkspaceFeedback =
  | Readonly<{ kind: 'message'; message: string }>
  | Readonly<{ kind: 'pending'; message: string; progress?: PlainTransferProgress }>
  | Readonly<{ kind: 'failed'; message: string; retry?: () => void }>

export type WorkspaceReport = (feedback: WorkspaceFeedback) => void

export function reportWorkspaceTextFeedback(
  report: WorkspaceReport,
  message: string,
  retry?: () => void,
): void {
  report(retry ? { kind: 'failed', message, retry } : { kind: 'message', message })
}

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
      kind: ResourceKind,
      parentId: ResourceId | null,
      title: string,
      signal?: AbortSignal,
    ) => createWorkspaceResource(runtime, kind, parentId, title, report, signal),
    createAssetFile: (file: File, signal?: AbortSignal) =>
      createWorkspaceAssetFile(runtime, file, report, signal),
    download: (resource: AuthorizedResourceSummary) =>
      downloadWorkspaceResource(runtime, resource, report),
    duplicate: (resourceIds: ReadonlyArray<ResourceId>, destinationParentId: ResourceId | null) =>
      duplicateWorkspaceResources(runtime, resourceIds, destinationParentId, report),
    drop: (
      drag: WorkspaceResourceDragPayload,
      target: WorkspaceResourceDropTarget,
      copy: boolean,
    ) => executeWorkspaceResourceDrop(runtime, drag, target, copy, report),
    importExternal: (
      destinationParentId: ResourceId | null,
      dataTransfer: BrowserPlainTransferData,
    ) => importWorkspaceDataTransfer(runtime, destinationParentId, dataTransfer, report),
    move: (resourceIds: ReadonlyArray<ResourceId>, destinationParentId: ResourceId | null) =>
      moveWorkspaceResources(runtime, resourceIds, destinationParentId, report),
    open: (resourceId: ResourceId) => runtime.navigation.open({ kind: 'resource', resourceId }),
    paste: (clipboard: WorkspaceClipboard, destinationParentId: ResourceId | null) =>
      pasteWorkspaceClipboard(runtime, clipboard, destinationParentId, report),
    report,
    update: (
      resourceId: ResourceId,
      values: Readonly<{ title?: string; icon?: string; color?: string }>,
    ) => updateWorkspaceResource(runtime, resourceId, values, report),
    undo: (direction: 'redo' | 'undo') => {
      const history = runtime.resources.undo
      if (history.status !== 'available') {
        reportFailure(report, `${direction === 'undo' ? 'Undo' : 'Redo'} is unavailable`)
        return Promise.resolve()
      }
      return runResourceUndo(history.value, direction, report)
    },
  }
}

export type WorkspaceActions = Readonly<ReturnType<typeof createWorkspaceActions>>

async function createWorkspaceResource(
  runtime: EditorRuntime,
  kind: ResourceKind,
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
      case 'file':
        return runtime.content.files.create({
          ...envelope,
          command: { ...command, kind: 'file' },
        })
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
  return await completeWorkspaceCreation({ state: 'expected', resourceId }, deliver, report, signal)
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
    reportFailure(report, 'Files cannot be imported in this workspace')
    return
  }
  reportPending(report, 'Reading dropped files…')
  let transfer
  try {
    transfer = await readBrowserPlainTransfer(dataTransfer)
  } catch {
    reportFailure(report, 'Could not read the dropped files')
    return
  }
  if (transfer.sources.length === 0) {
    reportMessage(report, 'No files were found in the drop')
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
      report({ kind: 'pending', message: `Importing resources${current}`, progress })
    })
  } catch {
    reportFailure(
      report,
      'Import failed',
      () => void settleWorkspaceDropTransfer(runtime, deliver, report),
    )
    return
  }
  if (result.status === 'indeterminate') {
    reportFailure(
      report,
      `Import status is unresolved: ${result.reason}`,
      () => void settleWorkspaceDropTransfer(runtime, deliver, report),
    )
    return
  }
  if (result.status === 'rejected') {
    reportFailure(report, `Import rejected: ${result.reason}`)
    return
  }
  if (result.status !== 'settled') {
    reportFailure(
      report,
      'Import status is unresolved',
      () => void settleWorkspaceDropTransfer(runtime, deliver, report),
    )
    return
  }
  if (result.entries.every((entry) => entry.status === 'cancelled')) {
    reportMessage(report, 'Import cancelled')
    return
  }
  const completed = result.entries.filter((entry) => entry.status === 'completed')
  const rejected = result.entries.filter((entry) => entry.status === 'rejected')
  reportMessage(report, workspaceTransferSummary(completed, rejected))
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
  reportPending(report, `Uploading ${file.name || 'file'}…`)
  let bytes
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    if (signal?.aborted) {
      reportMessage(report, 'Upload cancelled')
      return { status: 'cancelled' }
    }
    reportFailure(report, 'Upload failed: file could not be read')
    return { status: 'rejected', reason: 'file_read_failed' }
  }
  if (signal?.aborted) {
    reportMessage(report, 'Upload cancelled')
    return { status: 'cancelled' }
  }
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
  if (signal?.aborted) {
    reportMessage(report, 'Upload cancelled')
    return Promise.resolve({ status: 'cancelled' })
  }
  if (result.status === 'completed') {
    reportMessage(report, 'File uploaded')
    return Promise.resolve(result)
  }
  if (result.status === 'retryable') {
    reportFailure(report, 'Upload status is unknown')
    return Promise.resolve({
      status: 'indeterminate',
      reason: result.reason,
      retry: async () => await settleAssetFileCreation(await result.retry(), report),
    })
  }
  reportFailure(report, `Upload failed: ${humanizeReason(result.reason)}`)
  return Promise.resolve({ status: 'rejected', reason: result.reason })
}

async function downloadWorkspaceResource(
  runtime: EditorRuntime,
  resource: AuthorizedResourceSummary,
  report: WorkspaceReport,
): Promise<void> {
  if (resource.kind === 'folder') {
    reportFailure(report, 'Folders cannot be downloaded directly')
    return
  }
  reportPending(report, `Preparing ${resource.title}…`)
  const retry = () => void downloadWorkspaceResource(runtime, resource, report)
  try {
    const source = runtime.content[contentSourceName(resource.kind)]
    const result = await source.export(resource.id)
    if (result.status !== 'ready') {
      reportFailure(
        report,
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
    reportMessage(report, 'Download started')
  } catch {
    reportFailure(report, 'Download failed', retry)
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
  report: WorkspaceReport,
  signal?: AbortSignal,
): Promise<WorkspaceCreationSettlement> {
  if (signal?.aborted) return { status: 'cancelled' }
  let delivery: CommandDelivery<ResourceStructureCommandResult>
  try {
    delivery = await deliver(signal)
  } catch {
    const retry = () => completeWorkspaceCreation(expectation, deliver, report)
    return { status: 'failed', reason: 'provider_failure', retry }
  }
  if (delivery.status === 'indeterminate') {
    const retry = () => completeWorkspaceCreation(expectation, deliver, report)
    return { status: 'indeterminate', reason: delivery.reason, retry }
  }
  if (delivery.status === 'not_committed') {
    const retry = delivery.retryable
      ? () => completeWorkspaceCreation(expectation, deliver, report)
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
    return { status: 'completed', resourceId: result.resourceId }
  }
  reportFailure(report, deliveryMessage(delivery))
  return { status: 'rejected', reason: delivery.result.reason }
}

async function updateWorkspaceResource(
  runtime: EditorRuntime,
  resourceId: ResourceId,
  values: Readonly<{ title?: string; icon?: string; color?: string }>,
  report: WorkspaceReport,
) {
  let title: ReturnType<typeof canonicalizeResourceTitle> | undefined
  if (values.title !== undefined) {
    try {
      title = canonicalizeResourceTitle(values.title)
    } catch {
      reportFailure(report, 'Invalid resource title')
      return false
    }
  }
  return await executeWorkspaceStructureCommand(
    runtime,
    {
      type: 'updateMetadata',
      resourceId,
      changes: {
        ...(title === undefined ? {} : { title }),
        ...(values.icon === undefined ? {} : { icon: values.icon || null }),
        ...(values.color === undefined ? {} : { color: values.color || null }),
      },
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
  const command: ResourceStructureCommand =
    type === 'restore'
      ? { type, resourceIds, destination: 'previousParent' }
      : { type, resourceIds }
  return await executeWorkspaceStructureCommand(runtime, command, report, (delivery) => {
    clearDeletedTarget(runtime, delivery)
    if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
      reportFailure(report, deliveryMessage(delivery))
    }
  })
}

async function executeWorkspaceResourceDrop(
  runtime: EditorRuntime,
  drag: WorkspaceResourceDragPayload,
  target: WorkspaceResourceDropTarget,
  copy: boolean,
  report: WorkspaceReport,
) {
  const plan = planWorkspaceResourceDrop(runtime.resources.index.getSnapshot(), drag, target, copy)
  if (plan.status === 'rejected') {
    reportFailure(report, plan.label)
    return false
  }
  if (plan.command.type === 'deepCopy') {
    reportPending(
      report,
      drag.resourceIds.length === 1 ? 'Duplicating resource…' : 'Duplicating resources…',
    )
  }
  return await executeWorkspaceStructureCommand(runtime, plan.command, report, (delivery) =>
    finishWorkspaceDeepCopy(runtime, delivery, report),
  )
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

async function duplicateWorkspaceResources(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  destinationParentId: ResourceId | null,
  report: WorkspaceReport,
) {
  reportPending(
    report,
    resourceIds.length === 1 ? 'Duplicating resource…' : 'Duplicating resources…',
  )
  return await executeWorkspaceStructureCommand(
    runtime,
    {
      type: 'deepCopy',
      sourceRootIds: resourceIds,
      destinationParentId,
    },
    report,
    (delivery) => finishWorkspaceDeepCopy(runtime, delivery, report),
  )
}

function finishWorkspaceDeepCopy(
  runtime: EditorRuntime,
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  report: WorkspaceReport,
): void {
  if (
    delivery.status !== 'received' ||
    delivery.result.status !== 'completed' ||
    delivery.result.receipt.result.type !== 'deepCopied'
  ) {
    reportFailure(
      report,
      delivery.status === 'received' && delivery.result.status === 'completed'
        ? 'The copy response was invalid'
        : deliveryMessage(delivery),
    )
    return
  }
  const roots = delivery.result.receipt.result.roots
  if (roots.length === 1 && roots[0]) {
    runtime.navigation.open({ kind: 'resource', resourceId: roots[0].destinationRootId })
  }
  reportMessage(
    report,
    roots.length === 1 ? 'Resource duplicated' : `${roots.length} resources duplicated`,
  )
}

async function pasteWorkspaceClipboard(
  runtime: EditorRuntime,
  clipboard: WorkspaceClipboard,
  destinationParentId: ResourceId | null,
  report: WorkspaceReport,
): Promise<WorkspaceClipboard> {
  if (
    clipboard.status === 'empty' ||
    (destinationParentId !== null && clipboard.resourceIds.includes(destinationParentId))
  ) {
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
    reportFailure(report, 'Copy link is unavailable')
    return
  }
  const url = new URL(
    `/campaigns/${runtime.scope.campaignId}/editor?resource=${resource.id}`,
    globalThis.location?.origin ?? 'https://wizard-archive.invalid',
  )
  await navigator.clipboard.writeText(url.href)
  reportMessage(report, 'Link copied')
}

async function copyWorkspaceResourceId(
  resource: AuthorizedResourceSummary,
  report: WorkspaceReport,
) {
  if (!globalThis.navigator?.clipboard) {
    reportFailure(report, 'Copy resource ID is unavailable')
    return
  }
  await navigator.clipboard.writeText(resource.id)
  reportMessage(report, 'Resource ID copied')
}

async function setWorkspaceBookmarkState(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  bookmarked: boolean,
  report: WorkspaceReport,
) {
  const bookmarks = runtime.resources.bookmarks
  if (bookmarks.status !== 'available') {
    reportFailure(report, 'Bookmarks are unavailable')
    return false
  }
  try {
    const result = await bookmarks.value.setBookmarkState(resourceIds, bookmarked)
    if (result.status !== 'completed') {
      reportFailure(report, `Bookmark update rejected: ${humanizeReason(result.reason)}`)
      return false
    }
    return true
  } catch {
    reportFailure(
      report,
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
    reportFailure(
      report,
      delivery.result.status === 'rejected' && delivery.result.reason === 'history_conflict'
        ? `${label} is no longer safe because the resource changed`
        : `${label} is unavailable`,
    )
    return
  }
  const retry = delivery.retryable
    ? () => void runResourceUndo(history, direction, report)
    : undefined
  reportFailure(
    report,
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
  handle: (delivery: CommandDelivery<ResourceStructureCommandResult>) => void = (delivery) => {
    if (delivery.status !== 'received' || delivery.result.status !== 'completed') {
      reportFailure(report, deliveryMessage(delivery))
    }
  },
) {
  const structure = runtime.resources.structure
  if (structure.status !== 'available') {
    reportFailure(report, 'This workspace is read only')
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
      reportFailure(report, deliveryMessage(delivery), () => void attempt())
      return false
    }
    handle(delivery)
    return delivery.status === 'received' && delivery.result.status === 'completed'
  }
  return await attempt()
}

function deliveryMessage(delivery: CommandDelivery<ResourceStructureCommandResult>) {
  if (delivery.status === 'indeterminate') return 'Delivery is uncertain. Retry safely.'
  if (delivery.status === 'not_committed') {
    return `The change was not saved: ${humanizeReason(delivery.reason)}`
  }
  if (delivery.result.status === 'completed') return 'The change was saved'
  return `The change could not be completed: ${humanizeReason(delivery.result.reason)}`
}

function humanizeReason(reason: string): string {
  return reason.replaceAll('_', ' ')
}

function reportPending(report: WorkspaceReport, message: string): void {
  report({ kind: 'pending', message })
}

function reportMessage(report: WorkspaceReport, message: string): void {
  report({ kind: 'message', message })
}

function reportFailure(report: WorkspaceReport, message: string, retry?: () => void): void {
  report({ kind: 'failed', message, ...(retry ? { retry } : {}) })
}

export function resourceKindLabel(kind: ResourceKind) {
  return kind === 'map' ? 'Map' : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}
