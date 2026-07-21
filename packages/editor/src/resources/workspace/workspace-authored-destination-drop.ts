import type {
  AuthoredDestinationDropResult,
  AuthoredDestinationDropResolver,
  AuthoredResourceCreationSettlement,
} from '../authored-destination-drop'
import type { AuthoredDestination } from '../authored-destination-contract'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import type { ResourceId } from '../domain-id'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { readWorkspaceResourceDrag } from '../workspace-resource-drag'
import type { WorkspaceActions, WorkspaceCreationSettlement } from './resource-operations'

const EMPTY_DROP_RESULT: AuthoredDestinationDropResult = {
  kind: 'destinations',
  destinations: [],
}

export function createWorkspaceAuthoredDestinationDropResolver({
  actions,
  resolveResource,
}: {
  actions: Pick<WorkspaceActions, 'createAssetFile'>
  resolveResource: (resourceId: ResourceId) => AuthorizedResourceSummary | null
}): AuthoredDestinationDropResolver {
  return {
    canResolve: (dataTransfer) => {
      return (
        resolveActiveWorkspaceDrag(dataTransfer, resolveResource) !== null ||
        dataTransfer.types.includes('Files') ||
        dataTransfer.types.includes('text/uri-list')
      )
    },
    resolve: (dataTransfer, maximumDestinations, signal) => {
      if (signal.aborted) return Promise.resolve(EMPTY_DROP_RESULT)
      const resourceDrag = resolveActiveWorkspaceDrag(dataTransfer, resolveResource)
      if (resourceDrag) {
        return Promise.resolve({
          kind: 'destinations',
          destinations: resourceDrag.resourceIds
            .slice(0, maximumDestinations)
            .map(resourceDestination),
        })
      }
      const files = Array.from(dataTransfer.files).slice(0, maximumDestinations)
      if (files.length > 0) return createFileResources(files, actions, signal)
      const url = parseDroppedUrl(dataTransfer.getData('text/uri-list'))
      return Promise.resolve({
        kind: 'destinations',
        destinations: url ? [{ kind: 'externalUrl', url }] : [],
      })
    },
    resolveFiles: (files, maximumDestinations, signal) =>
      createFileResources(files.slice(0, maximumDestinations), actions, signal),
  }
}

function resolveActiveWorkspaceDrag(
  dataTransfer: Pick<DataTransfer, 'getData'>,
  resolveResource: (resourceId: ResourceId) => AuthorizedResourceSummary | null,
) {
  const drag = readWorkspaceResourceDrag(dataTransfer)
  return drag?.resourceIds.every(
    (resourceId) => resolveResource(resourceId)?.lifecycle === 'active',
  )
    ? drag
    : null
}

function resourceDestination(resourceId: ResourceId): AuthoredDestination {
  return { kind: 'internal', target: { kind: 'resource', resourceId } }
}

async function createFileResources(
  files: ReadonlyArray<File>,
  actions: Pick<WorkspaceActions, 'createAssetFile'>,
  signal: AbortSignal,
): Promise<AuthoredDestinationDropResult> {
  const settlements = await Promise.all(files.map((file) => actions.createAssetFile(file, signal)))
  return {
    kind: 'resourceCreations',
    settlements: settlements.map(projectResourceCreationSettlement),
  }
}

function projectResourceCreationSettlement(
  settlement: WorkspaceCreationSettlement,
): AuthoredResourceCreationSettlement {
  switch (settlement.status) {
    case 'completed':
    case 'cancelled':
    case 'rejected':
      return settlement
    case 'indeterminate':
      return {
        status: settlement.status,
        reason:
          settlement.reason === 'transport_unavailable' ? 'connection_lost' : settlement.reason,
        retry: async () => projectResourceCreationSettlement(await settlement.retry()),
      }
    case 'failed': {
      const retry = settlement.retry
      return {
        status: settlement.status,
        reason: settlement.reason,
        retry: retry ? async () => projectResourceCreationSettlement(await retry()) : null,
      }
    }
  }
}

function parseDroppedUrl(uriList: string) {
  const candidate = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'))
  return candidate ? parseSafeHttpsUrl(candidate) : null
}
