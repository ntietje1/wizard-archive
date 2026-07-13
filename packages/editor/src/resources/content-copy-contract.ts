import type { CanonicalTarget } from './authored-destination-contract'
import type { ResourceId } from './domain-id'

export type ResourceCopyMapEntry = Readonly<{
  sourceId: ResourceId
  destinationId: ResourceId
}>

export type CanonicalTargetMapEntry = Readonly<{
  source: CanonicalTarget
  destination: CanonicalTarget
}>

export type ContentCopyContext = Readonly<{
  sourceResourceIds: ReadonlyArray<ResourceId>
  resourceMap: ReadonlyArray<ResourceCopyMapEntry>
}>

export interface ContentCopyPlanner<TPlan, TFinalized> {
  prepare(context: ContentCopyContext): Promise<TPlan>
  referenceableTargets(plan: TPlan): ReadonlyArray<CanonicalTargetMapEntry>
  finalize(plan: TPlan, targetMap: ReadonlyArray<CanonicalTargetMapEntry>): Promise<TFinalized>
}
