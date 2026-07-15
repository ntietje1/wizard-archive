import type { ContentCopyPlanner } from './content-copy-contract'
import type { ResourceCatalogSnapshot } from './resource-catalog-contract'
import type {
  CommandDelivery,
  ResourceStructureCommandResult,
  ResourceStructureCommandGateway,
} from './resource-command-contract'
import type { ResourceId } from './domain-id'
import { InMemoryResourceCatalog } from './in-memory-resource-catalog'
import type { InMemoryResourceOperationsOptions } from './in-memory-resource-catalog'
import type {
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceProjectionScope,
} from './resource-index-contract'
import {
  authorizedResourceSummaryFromRecord,
  normalizeResourceCollectionQuery,
  resourceCollectionQueryKey,
  resourceMatchesCollectionQuery,
  sameResourceProjectionScope,
} from './resource-index-contract'
import { createOptimisticResourceStructureRuntime } from './resource-optimistic-runtime'
import {
  MutableWorkspaceResourceIndex,
  createResourceIndexLoader,
  indexRevision,
} from './workspace-resource-index'

export type InMemoryResourceRuntimeOptions<TContentCopyPlan = never> = Readonly<{
  scope: ResourceProjectionScope
  initialSnapshot: ResourceCatalogSnapshot
  authorize: InMemoryResourceOperationsOptions<TContentCopyPlan>['authorize']
  contentCopy?: ContentCopyPlanner<TContentCopyPlan, () => void>
  now?: () => number
}>

function addAncestorSpine(
  resourceId: ResourceId,
  resourcesById: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
  includedIds: Set<ResourceId>,
): void {
  let current = resourcesById.get(resourceId)
  while (current) {
    includedIds.add(current.id)
    current =
      current.displayParentId === null ? undefined : resourcesById.get(current.displayParentId)
  }
}

function projectionSignature(snapshot: Omit<AuthorizedResourceSnapshot, 'revision'>): string {
  return JSON.stringify({
    resources: snapshot.resources,
    missingResourceIds: snapshot.missingResourceIds,
    collections: snapshot.collections,
  })
}

export function createInMemoryResourceRuntime<TContentCopyPlan = never>({
  scope,
  initialSnapshot,
  authorize,
  contentCopy,
  now,
}: InMemoryResourceRuntimeOptions<TContentCopyPlan>) {
  if (initialSnapshot.campaignId !== scope.campaignId) {
    throw new TypeError('In-memory resource runtime scope does not own its initial snapshot')
  }

  const catalog = new InMemoryResourceCatalog({ initialSnapshot })
  const operations = catalog.operations({
    authorize,
    ...(contentCopy ? { contentCopy } : {}),
    ...(now ? { now } : {}),
  })
  const baseIndex = new MutableWorkspaceResourceIndex(scope, indexRevision('memory-0'))
  const loadedResourceIds = new Set<ResourceId>()
  const loadedCollections = new Map<string, ResourceCollectionQuery>()
  let revision = 0
  let lastSignature = projectionSignature({
    scope,
    resources: [],
    missingResourceIds: [],
    collections: [],
  })

  const refresh = () => {
    const snapshot = catalog.getSnapshot(scope.campaignId)
    const resources = snapshot.resources.map(authorizedResourceSummaryFromRecord)
    const resourcesById = new Map(resources.map((resource) => [resource.id, resource]))
    const includedIds = new Set<ResourceId>()
    for (const resourceId of loadedResourceIds) {
      addAncestorSpine(resourceId, resourcesById, includedIds)
    }
    const collections = Array.from(loadedCollections.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, query]) => {
        const resourceIds: Array<ResourceId> = []
        for (const resource of resources) {
          if (resourceMatchesCollectionQuery(resource, query)) resourceIds.push(resource.id)
        }
        resourceIds.sort()
        for (const resourceId of resourceIds) {
          addAncestorSpine(resourceId, resourcesById, includedIds)
        }
        return { query, resourceIds, complete: true }
      })
    const projected = {
      scope,
      resources: resources.filter((resource) => includedIds.has(resource.id)),
      missingResourceIds: Array.from(loadedResourceIds)
        .filter((resourceId) => !resourcesById.has(resourceId))
        .sort(),
      collections,
    }
    const signature = projectionSignature(projected)
    if (signature === lastSignature) return
    lastSignature = signature
    revision += 1
    baseIndex.replaceSnapshot({ ...projected, revision: indexRevision(`memory-${revision}`) })
  }

  const unsubscribe = catalog.subscribe(scope.campaignId, refresh)
  const loader = createResourceIndexLoader(baseIndex, {
    loadResource: (currentScope, resourceId) => {
      if (!sameResourceProjectionScope(currentScope, scope)) {
        return Promise.resolve({ status: 'scope_changed' as const })
      }
      loadedResourceIds.add(resourceId)
      refresh()
      return Promise.resolve({ status: 'completed' as const })
    },
    loadCollection: (currentScope, query) => {
      if (!sameResourceProjectionScope(currentScope, scope)) {
        return Promise.resolve({ status: 'scope_changed' as const })
      }
      const normalized = normalizeResourceCollectionQuery(query)
      loadedCollections.set(resourceCollectionQueryKey(normalized), normalized)
      refresh()
      return Promise.resolve({ status: 'completed' as const })
    },
  })
  const authoritative: ResourceStructureCommandGateway = {
    execute: async (envelope): Promise<CommandDelivery<ResourceStructureCommandResult>> => {
      const result = await operations.execute(scope.actorId, envelope)
      if (result.status === 'completed') {
        for (const postcondition of result.receipt.postconditions) {
          loadedResourceIds.add(postcondition.resourceId)
        }
        refresh()
      }
      return { status: 'received', result }
    },
  }
  const optimistic = createOptimisticResourceStructureRuntime(baseIndex, authoritative, now)

  return {
    dispose: () => {
      unsubscribe()
      optimistic.dispose()
    },
    index: optimistic.index,
    loader,
    structure: optimistic.structure,
  }
}
