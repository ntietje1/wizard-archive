import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CanvasNodeId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import { remapAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import {
  createCanvasDocumentDoc,
  canvasAuthoredDestinations,
  parseCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '@wizard-archive/editor/canvas/document-contract'
import * as Y from 'yjs'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { initialBinaryContentVersion } from './contentVersion'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { encodeYjsDocument, resourceReferencesAreValid } from './contentCopyTypes'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'
import { authorizeResourceContent } from './authorizeResourceContent'
import { replaceResourceReferenceProjection } from './resourceReferences'

const EMPTY_YJS_UPDATE = new Uint8Array([0, 0]).buffer as ArrayBuffer

export async function createCanvasContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  const existing = await ctx.db
    .query('resourceCanvasContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (existing) {
    if (existing.campaignUuid === campaignId) return
    throw new TypeError('Canvas content already exists')
  }
  await ctx.db.insert('resourceCanvasContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    update: EMPTY_YJS_UPDATE,
    version: await initialBinaryContentVersion(EMPTY_YJS_UPDATE),
  })
}

export async function loadCanvasContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'canvas')
  if (authorization.status !== 'authorized') return authorization
  const content = await ctx.db
    .query('resourceCanvasContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (content?.campaignUuid !== ctx.resourceScope.campaignId) {
    return {
      status: 'integrity_error' as const,
      issue: content ? ('content_corrupt' as const) : ('content_missing' as const),
    }
  }
  if (!canvasEncodedBytesWithinWorkload(content.update)) {
    return { status: 'integrity_error' as const, issue: 'content_limit_exceeded' as const }
  }
  return {
    status: 'ready' as const,
    update: content.update,
    version: content.version,
  }
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
        if (!canvasEncodedBytesWithinWorkload(update)) {
          throw new TypeError('Copied canvas exceeds the workload contract')
        }
        const version = await initialBinaryContentVersion(update)
        return async () => {
          await ctx.db.insert('resourceCanvasContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            update,
            version,
          })
          if (
            (
              await replaceResourceReferenceProjection(ctx, {
                campaignId,
                sourceResourceId: destinationResourceId,
                sourceVersion: version,
                destinations: canvasAuthoredDestinations(nodes),
              })
            ).status !== 'completed'
          ) {
            throw new RangeError('Copied canvas reference projection exceeds its bound')
          }
        }
      },
    },
  }
}

function decodeCanvasContent(
  update: ArrayBuffer,
): { nodes: Array<CanvasDocumentNode>; edges: Array<CanvasDocumentEdge> } | null {
  if (!canvasEncodedBytesWithinWorkload(update)) return null
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
      if (node.type === 'embed' && node.data.destination?.kind === 'internal') {
        resourceIds.push(node.data.destination.target.resourceId)
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
  const data = remapCanvasNodeData(node, targetMap)
  return { ...node, id: nodeMap.get(node.id)!, data } as CanvasDocumentNode
}

function remapCanvasNodeData(
  node: CanvasDocumentNode,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
) {
  if (node.type !== 'embed' || node.data.destination === undefined) return node.data
  const result = remapAuthoredDestination(node.data.destination, targetMap, 'same_campaign_copy')
  if (result.status !== 'completed') throw new TypeError('Unmapped authored destination')
  return { ...node.data, destination: result.destination }
}
