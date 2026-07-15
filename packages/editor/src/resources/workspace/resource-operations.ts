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

export type WorkspaceReport = (message: string, retry?: () => void) => void

export async function createWorkspaceResource(
  runtime: EditorRuntime,
  kind: ResourceKind,
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
  const attempt = async (): Promise<void> => {
    const delivery = await deliver()
    if (delivery.status === 'indeterminate') {
      report(deliveryMessage(delivery), () => void attempt())
      return
    }
    if (delivery.status === 'received' && delivery.result.status === 'completed') {
      runtime.navigation.open(resourceId)
      report(`${resourceKindLabel(kind)} created`)
      return
    }
    report(deliveryMessage(delivery))
  }
  await attempt()
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

export async function moveWorkspaceResourceToRoot(
  runtime: EditorRuntime,
  resourceId: ResourceId,
  report: WorkspaceReport,
) {
  await executeWorkspaceStructureCommand(
    runtime,
    { type: 'move', resourceIds: [resourceId], destinationParentId: null },
    report,
  )
}

export async function changeWorkspaceResourceLifecycle(
  runtime: EditorRuntime,
  resourceId: ResourceId,
  type: 'permanentlyDelete' | 'restore' | 'trash',
  report: WorkspaceReport,
) {
  await executeWorkspaceStructureCommand(runtime, { type, resourceIds: [resourceId] }, report)
}

export async function duplicateWorkspaceResource(
  runtime: EditorRuntime,
  resource: AuthorizedResourceSummary,
  report: WorkspaceReport,
) {
  await executeWorkspaceStructureCommand(
    runtime,
    {
      type: 'deepCopy',
      sourceRootIds: [resource.id],
      destinationParentId: resource.displayParentId,
    },
    report,
    (delivery) => {
      if (
        delivery.status === 'received' &&
        delivery.result.status === 'completed' &&
        delivery.result.receipt.result.type === 'deepCopied'
      ) {
        const destinationId = delivery.result.receipt.result.roots[0]?.destinationRootId
        if (destinationId) runtime.navigation.open(destinationId)
        report('Resource duplicated')
        return
      }
      report(deliveryMessage(delivery))
    },
  )
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
