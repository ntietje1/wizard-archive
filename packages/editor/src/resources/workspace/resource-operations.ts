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
import { EMPTY_WORKSPACE_CLIPBOARD } from '../workspace-clipboard'
import type { WorkspaceClipboard } from '../workspace-clipboard'

export type WorkspaceReport = (message: string, retry?: () => void) => void

const MAX_EMPTY_TRASH_ROOTS_PER_COMMAND = 25

export async function createWorkspaceResource(
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
  const deliver =
    kind === 'note'
      ? (() => {
          const document = new Y.Doc()
          return () =>
            runtime.content.notes.create(
              {
                campaignId: runtime.scope.campaignId,
                operationId,
                command: { ...command, kind: 'note' },
              },
              document,
            )
        })()
      : () =>
          structure.value.execute({
            campaignId: runtime.scope.campaignId,
            operationId,
            command,
          })
  await completeWorkspaceCreation(
    runtime,
    resourceId,
    deliver,
    `${resourceKindLabel(kind)} created`,
    report,
  )
}

export async function createWorkspaceFile(
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

export async function updateWorkspaceResource(
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

export async function moveWorkspaceResources(
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

export async function changeWorkspaceResourcesLifecycle(
  runtime: EditorRuntime,
  resourceIds: ReadonlyArray<ResourceId>,
  type: 'permanentlyDelete' | 'restore' | 'trash',
  report: WorkspaceReport,
) {
  return await executeWorkspaceStructureCommand(runtime, { type, resourceIds }, report)
}

export async function emptyWorkspaceTrash(
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

export async function duplicateWorkspaceResources(
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

export async function pasteWorkspaceClipboard(
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

export async function copyWorkspaceResourceLink(
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

export async function copyWorkspaceResourceId(
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

export async function setWorkspaceBookmarkState(
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
