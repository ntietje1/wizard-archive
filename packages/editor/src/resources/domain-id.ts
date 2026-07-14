import { formatUuid } from '../types/uuid'

export const DOMAIN_ID_KIND = {
  asset: 'asset',
  campaign: 'campaign',
  campaignMember: 'campaignMember',
  canvasNode: 'canvasNode',
  exportJob: 'exportJob',
  historyEntry: 'historyEntry',
  importJob: 'importJob',
  mapPin: 'mapPin',
  noteBlock: 'noteBlock',
  operation: 'operation',
  resource: 'resource',
  resourceShare: 'resourceShare',
  session: 'session',
  snapshot: 'snapshot',
} as const

export type DomainIdKind = (typeof DOMAIN_ID_KIND)[keyof typeof DOMAIN_ID_KIND]
export type UuidV7 = string & { readonly __uuidV7: true }
type DomainId<TKind extends DomainIdKind> = UuidV7 & {
  readonly __domainIdKind: TKind
}

export type AssetId = DomainId<typeof DOMAIN_ID_KIND.asset>
export type CampaignId = DomainId<typeof DOMAIN_ID_KIND.campaign>
export type CampaignMemberId = DomainId<typeof DOMAIN_ID_KIND.campaignMember>
export type CanvasNodeId = DomainId<typeof DOMAIN_ID_KIND.canvasNode>
export type ExportJobId = DomainId<typeof DOMAIN_ID_KIND.exportJob>
export type HistoryEntryId = DomainId<typeof DOMAIN_ID_KIND.historyEntry>
export type ImportJobId = DomainId<typeof DOMAIN_ID_KIND.importJob>
export type MapPinId = DomainId<typeof DOMAIN_ID_KIND.mapPin>
export type NoteBlockId = DomainId<typeof DOMAIN_ID_KIND.noteBlock>
export type OperationId = DomainId<typeof DOMAIN_ID_KIND.operation>
export type ResourceId = DomainId<typeof DOMAIN_ID_KIND.resource>
export type ResourceShareId = DomainId<typeof DOMAIN_ID_KIND.resourceShare>
export type SessionId = DomainId<typeof DOMAIN_ID_KIND.session>
export type SnapshotId = DomainId<typeof DOMAIN_ID_KIND.snapshot>

export type DomainIdByKind = {
  [DOMAIN_ID_KIND.asset]: AssetId
  [DOMAIN_ID_KIND.campaign]: CampaignId
  [DOMAIN_ID_KIND.campaignMember]: CampaignMemberId
  [DOMAIN_ID_KIND.canvasNode]: CanvasNodeId
  [DOMAIN_ID_KIND.exportJob]: ExportJobId
  [DOMAIN_ID_KIND.historyEntry]: HistoryEntryId
  [DOMAIN_ID_KIND.importJob]: ImportJobId
  [DOMAIN_ID_KIND.mapPin]: MapPinId
  [DOMAIN_ID_KIND.noteBlock]: NoteBlockId
  [DOMAIN_ID_KIND.operation]: OperationId
  [DOMAIN_ID_KIND.resource]: ResourceId
  [DOMAIN_ID_KIND.resourceShare]: ResourceShareId
  [DOMAIN_ID_KIND.session]: SessionId
  [DOMAIN_ID_KIND.snapshot]: SnapshotId
}

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isUuidV7(value: string): value is UuidV7 {
  return UUID_V7_PATTERN.test(value)
}

export function parseDomainId<TKind extends DomainIdKind>(
  kind: TKind,
  value: string,
): DomainIdByKind[TKind] | null {
  if (!Object.values(DOMAIN_ID_KIND).includes(kind)) return null
  return isUuidV7(value) ? (value as DomainIdByKind[TKind]) : null
}

export function assertDomainId<TKind extends DomainIdKind>(
  kind: TKind,
  value: string,
): DomainIdByKind[TKind] {
  const parsed = parseDomainId(kind, value)
  if (!parsed) throw new TypeError(`Expected a lowercase UUIDv7 ${kind} id`)
  return parsed
}

export function generateDomainId<TKind extends DomainIdKind>(kind: TKind): DomainIdByKind[TKind] {
  return assertDomainId(kind, generateUuidV7())
}

export function generateUuidV7(): UuidV7 {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let timestamp = BigInt(Date.now())

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn)
    timestamp >>= 8n
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x70
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  return formatUuid(bytes) as UuidV7
}
