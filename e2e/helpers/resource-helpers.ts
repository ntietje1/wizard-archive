import { api } from 'convex/_generated/api'
import * as Y from 'yjs'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '@wizard-archive/editor/notes/document-yjs'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { createE2EConvexClient } from './convex-helpers'

export async function provisionCanvasResource(
  campaignId: CampaignId,
  title: string,
): Promise<ResourceId> {
  const client = await createE2EConvexClient()
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const result = await client.mutation(api.resources.mutations.createCanvasResource, {
    campaignId,
    operationId,
    command: {
      type: 'create',
      resourceId,
      kind: 'canvas',
      parentId: null,
      title: canonicalizeResourceTitle(title),
      icon: null,
      color: null,
    },
  })
  if (result.status !== 'completed' || result.receipt.result.type !== 'created') {
    throw new Error(`Canvas fixture provisioning failed: ${JSON.stringify(result)}`)
  }
  return resourceId
}

export async function provisionNoteResource(
  campaignId: CampaignId,
  title: string,
  blocks: Array<PartialNoteBlock> = [{ type: 'paragraph' }],
): Promise<ResourceId> {
  const client = await createE2EConvexClient()
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const operationId = generateDomainId(DOMAIN_ID_KIND.operation)
  const document = noteBlocksToYDoc(blocks, NOTE_YJS_FRAGMENT)
  const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
  document.destroy()
  const result = await client.mutation(api.resources.mutations.createNoteResource, {
    campaignId,
    operationId,
    command: {
      type: 'create',
      resourceId,
      kind: 'note',
      parentId: null,
      title: canonicalizeResourceTitle(title),
      icon: null,
      color: null,
    },
    update,
  })
  if (result.status !== 'completed' || result.receipt.result.type !== 'created') {
    throw new Error(`Note fixture provisioning failed: ${JSON.stringify(result)}`)
  }
  return resourceId
}
