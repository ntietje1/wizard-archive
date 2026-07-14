import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CanvasNodeId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import {
  createCanvasDocumentDoc,
  parseCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '@wizard-archive/editor/canvas/document-contract'
import * as Y from 'yjs'
import type { CampaignMutationCtx } from '../../functions'
import { initialBinaryContentVersion } from './contentVersion'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { encodeYjsDocument, remapResourceId, resourceReferencesAreValid } from './contentCopyTypes'

const EMPTY_YJS_UPDATE = new Uint8Array([0, 0]).buffer as ArrayBuffer

export async function createCanvasContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceCanvasContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    update: EMPTY_YJS_UPDATE,
    version: await initialBinaryContentVersion(EMPTY_YJS_UPDATE),
  })
}

export async function loadCanvasContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('resourceCanvasContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

export async function prepareCanvasContentCopy(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
): Promise<ContentCopyPreparation> {
  const content = await loadCanvasContentDeletion(ctx, sourceResourceId)
  if (!content || content.campaignUuid !== campaignId) return { status: 'integrity_error' }

  const decoded = decodeCanvasContent(content.update)
  if (!decoded || !(await canvasReferencesAreValid(ctx, campaignId, decoded.nodes))) {
    return { status: 'integrity_error' }
  }
  const nodeMap = new Map(
    decoded.nodes.map((node) => [node.id, generateDomainId(DOMAIN_ID_KIND.canvasNode)]),
  )
  const referenceableTargets: Array<CanonicalTargetMapEntry> = decoded.nodes.map((node) => ({
    source: { kind: 'canvasNode', resourceId: sourceResourceId, nodeId: node.id },
    destination: {
      kind: 'canvasNode',
      resourceId: destinationResourceId,
      nodeId: nodeMap.get(node.id)!,
    },
  }))

  return {
    status: 'ready',
    plan: {
      referenceableTargets,
      finalize: async (targetMap) => {
        const nodes = decoded.nodes.map((node) => remapCanvasNode(node, nodeMap, targetMap))
        const edges = decoded.edges.map((edge) => ({
          ...edge,
          id: `e-${nodeMap.get(edge.source)!}-${nodeMap.get(edge.target)!}-${crypto.randomUUID()}`,
          source: nodeMap.get(edge.source)!,
          target: nodeMap.get(edge.target)!,
        }))
        const update = encodeYjsDocument(createCanvasDocumentDoc({ nodes, edges }))
        const version = await initialBinaryContentVersion(update)
        return async () => {
          await ctx.db.insert('resourceCanvasContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            update,
            version,
          })
        }
      },
    },
  }
}

function decodeCanvasContent(
  update: ArrayBuffer,
): { nodes: Array<CanvasDocumentNode>; edges: Array<CanvasDocumentEdge> } | null {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, new Uint8Array(update))
    const content = parseCanvasDocumentContent(doc)
    return content ? { nodes: [...content.nodes], edges: [...content.edges] } : null
  } catch {
    return null
  } finally {
    doc.destroy()
  }
}

async function canvasReferencesAreValid(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  nodes: ReadonlyArray<CanvasDocumentNode>,
): Promise<boolean> {
  const resourceIds: Array<ResourceId> = []
  try {
    for (const node of nodes) {
      if (node.type === 'embed' && node.data.target?.kind === 'resource') {
        resourceIds.push(assertDomainId(DOMAIN_ID_KIND.resource, node.data.target.resourceId))
      }
    }
  } catch {
    return false
  }
  return await resourceReferencesAreValid(ctx, campaignId, resourceIds)
}

function remapCanvasNode(
  node: CanvasDocumentNode,
  nodeMap: ReadonlyMap<CanvasNodeId, CanvasNodeId>,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
): CanvasDocumentNode {
  const data =
    node.type === 'embed' && node.data.target?.kind === 'resource'
      ? {
          ...node.data,
          target: {
            ...node.data.target,
            resourceId: remapResourceId(targetMap, node.data.target.resourceId),
          },
        }
      : node.data
  return { ...node, id: nodeMap.get(node.id)!, data } as CanvasDocumentNode
}
