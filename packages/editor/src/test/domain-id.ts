import { deterministicUuidV7 } from '../../../../shared/test/deterministic-uuid-v7'
import { assertDomainId } from '../resources/domain-id'
import type { DomainIdByKind, DomainIdKind } from '../resources/domain-id'

export function testDomainId<TKind extends DomainIdKind>(
  kind: TKind,
  label: string,
): DomainIdByKind[TKind] {
  return assertDomainId(kind, deterministicUuidV7(`${kind}:${label}`))
}
