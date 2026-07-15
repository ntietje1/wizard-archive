import { assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { DomainIdByKind, DomainIdKind } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testDomainId<TKind extends DomainIdKind>(
  kind: TKind,
  label: string,
): DomainIdByKind[TKind] {
  return assertDomainId(kind, deterministicUuidV7(label))
}
