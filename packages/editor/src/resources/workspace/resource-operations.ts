import * as Y from 'yjs'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
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

export type WorkspaceReport = (message: string, retry?: () => void) => void

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
    create: (kind: Exclude<ResourceKind, 'file'>, parentId: ResourceId | null, title: string) =>
      createWorkspaceResource(runtime, kind, parentId, title, report),
    createFile: (parentId: ResourceId | null, file: File) =>
      createWorkspaceFile(runtime, parentId, file, report),
    download: (resource: AuthorizedResourceSummary) =>
      downloadWorkspaceResource(runtime, resource, report),
    duplicate: (resourceIds: ReadonlyArray<ResourceId>, destinationParentId: ResourceId | null) =>
      duplicateWorkspaceResources(runtime, resourceIds, destinationParentId, report),
    emptyTrash: (resourceIds: ReadonlyArray<ResourceId>) =>
      emptyWorkspaceTrash(runtime, resourceIds, report),
    move: (resourceIds: ReadonlyArray<ResourceId>, destinationParentId: ResourceId | null) =>
      moveWorkspaceResources(runtime, resourceIds, destinationParentId, report),
    open: (resourceId: ResourceId) => runtime.navigation.open(resourceId),
    paste: (clipboard: WorkspaceClipboard, destinationParentId: ResourceId) =>
      pasteWorkspaceClipboard(runtime, clipboard, destinationParentId, report),
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
) {
  const structure = runtime.resources.structure
  if (structure.status !== 'available') {
    report('This workspace is read only')
    return
  }
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const command = {
    type: 'create' as const,
    resourceId,
    kind,
    parentId,
    title: canonicalizeResourceTitle(title || `Untitled ${kind}`),
    icon: null,
    color: null,
  }
  const envelope = { campaignId: runtime.scope.campaignId, operationId, command }
  const deliver = () => {
    switch (kind) {
      case 'folder':
        return structure.value.execute(envelope)
      case 'note':
        return runtime.content.notes.create(
          { ...envelope, command: { ...command, kind: 'note' } },
          new Y.Doc(),
        )
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
  await completeWorkspaceCreation(
    runtime,
    resourceId,
    deliver,
    `${resourceKindLabel(kind)} created`,
    report,
  )
}

async function createWorkspaceFile(
  runtime: EditorRuntime,
  parentId: ResourceId | null,
  file: File,
  report: WorkspaceReport,
) {
  if (runtime.resources.structure.status !== 'available') {
    report('This workspace is read only')
    return
  }
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const source = { bytes: new Uint8Array(await file.arrayBuffer()), fileName: file.name }
  const envelope = {
    campaignId: runtime.scope.campaignId,
    operationId,
    command: {
      type: 'create' as const,
      resourceId,
      kind: 'file' as const,
      parentId,
      title: canonicalizeResourceTitle(file.name),
      icon: null,
      color: null,
    },
  }
  await completeWorkspaceCreation(
    runtime,
    resourceId,
    () => runtime.content.files.create(envelope, source),
    'File uploaded',
    report,
  )
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
  runtime: EditorRuntime,
  resourceId: ResourceId,
  deliver: () => Promise<CommandDelivery<ResourceStructureCommandResult>>,
  successMessage: string,
  report: WorkspaceReport,
): Promise<void> {
  const delivery = await deliver()
  if (delivery.status === 'indeterminate') {
    report(
      deliveryMessage(delivery),
      () => void completeWorkspaceCreation(runtime, resourceId, deliver, successMessage, report),
    )
    return
  }
  if (delivery.status === 'received' && delivery.result.status === 'completed') {
    runtime.navigation.open(resourceId)
    report(successMessage)
    return
  }
  report(deliveryMessage(delivery))
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
  return await executeWorkspaceStructureCommand(runtime, { type, resourceIds }, report)
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
    await run(batchIndex + 1, newOperationId())
  }
  await run(0, newOperationId())
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
        if (roots.length === 1 && roots[0]) runtime.navigation.open(roots[0].destinationRootId)
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
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const attempt = async (): Promise<boolean> => {
    const delivery = await bookmarks.value.execute({
      campaignId: runtime.scope.campaignId,
      operationId,
      command: { type: 'setBookmarkState', resourceIds, bookmarked },
    })
    if (delivery.status === 'indeterminate') {
      report('Delivery is uncertain. Retry safely.', () => void attempt())
      return false
    }
    if (delivery.status === 'not_committed') {
      report(`Not committed: ${delivery.reason}`)
      return false
    }
    if (delivery.result.status !== 'completed') {
      report(`${delivery.result.status}: ${delivery.result.reason}`)
      return false
    }
    report(bookmarked ? 'Bookmarked' : 'Bookmark removed')
    return true
  }
  return await attempt()
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
