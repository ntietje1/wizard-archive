import type { CanonicalTargetMapEntry } from '@wizard-archive/editor/resources/content-copy-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import * as Y from 'yjs'
import { findCanonicalResource } from './findCanonicalResource'

export type PreparedContentCopy = Readonly<{
  referenceableTargets: ReadonlyArray<CanonicalTargetMapEntry>
  finalize(targetMap: ReadonlyArray<CanonicalTargetMapEntry>): Promise<() => Promise<void>>
}>

export type ContentCopyPreparation =
  | { status: 'ready'; plan: PreparedContentCopy }
  | { status: 'unavailable' }
  | { status: 'integrity_error' }

export function encodeYjsDocument(doc: Y.Doc): ArrayBuffer {
  try {
    return Uint8Array.from(Y.encodeStateAsUpdate(doc)).buffer
  } finally {
    doc.destroy()
  }
}

export async function resourceReferencesAreValid(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  values: ReadonlyArray<string>,
): Promise<boolean> {
  let resourceIds: Array<ResourceId>
  try {
    resourceIds = values.map((value) => assertDomainId(DOMAIN_ID_KIND.resource, value))
  } catch {
    return false
  }
  const resources = await Promise.all(
    [...new Set(resourceIds)].map((resourceId) => findCanonicalResource(ctx.db, resourceId)),
  )
  return resources.every((resource) => resource?.campaignUuid === campaignId)
}
