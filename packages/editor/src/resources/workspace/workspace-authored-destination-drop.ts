import type { AuthoredDestinationDropResolver } from '../authored-destination-drop'
import type { AuthoredDestination } from '../authored-destination-contract'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import type { ResourceId } from '../domain-id'
import { hasWorkspaceResourceDrag, readWorkspaceResourceDrag } from '../workspace-resource-drag'
import type { WorkspaceActions } from './resource-operations'

export function createWorkspaceAuthoredDestinationDropResolver({
  actions,
  parentId,
}: {
  actions: Pick<WorkspaceActions, 'createFile'>
  parentId: ResourceId | null
}): AuthoredDestinationDropResolver {
  return {
    canResolve: (dataTransfer) =>
      hasWorkspaceResourceDrag(dataTransfer) ||
      dataTransfer.types.includes('Files') ||
      dataTransfer.types.includes('text/uri-list'),
    resolve: (dataTransfer, maximumDestinations, signal) => {
      if (signal.aborted) return Promise.resolve([])
      const resourceDrag = readWorkspaceResourceDrag(dataTransfer)
      if (resourceDrag?.lifecycle === 'active') {
        return Promise.resolve(
          resourceDrag.resourceIds.slice(0, maximumDestinations).map(resourceDestination),
        )
      }
      const files = Array.from(dataTransfer.files).slice(0, maximumDestinations)
      if (files.length > 0) return createFileDestinations(files, actions, parentId, signal)
      const url = parseDroppedUrl(dataTransfer.getData('text/uri-list'))
      return Promise.resolve(url ? [{ kind: 'externalUrl', url }] : [])
    },
    resolveFiles: (files, maximumDestinations, signal) =>
      createFileDestinations(files.slice(0, maximumDestinations), actions, parentId, signal),
  }
}

function resourceDestination(resourceId: ResourceId): AuthoredDestination {
  return { kind: 'internal', target: { kind: 'resource', resourceId } }
}

async function createFileDestinations(
  files: ReadonlyArray<File>,
  actions: Pick<WorkspaceActions, 'createFile'>,
  parentId: ResourceId | null,
  signal: AbortSignal,
): Promise<ReadonlyArray<AuthoredDestination>> {
  const settlements = await Promise.all(
    files.map((file) => actions.createFile(parentId, file, signal)),
  )
  if (signal.aborted) return []
  return settlements.flatMap((settlement) =>
    settlement.status === 'completed' ? [resourceDestination(settlement.resourceId)] : [],
  )
}

function parseDroppedUrl(uriList: string) {
  const candidate = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'))
  return candidate ? parseSafeHttpsUrl(candidate) : null
}
