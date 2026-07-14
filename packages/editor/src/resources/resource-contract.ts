import type { VersionStamp } from './component-version'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'

export const MAX_SYNCHRONOUS_RESOURCE_CLOSURE = 500

export const RESOURCE_KIND = {
  canvas: 'canvas',
  file: 'file',
  folder: 'folder',
  map: 'map',
  note: 'note',
} as const

export type ResourceKind = (typeof RESOURCE_KIND)[keyof typeof RESOURCE_KIND]
export type ResourceColor = string
export type ResourceIcon = string
export type ResourceTitle = string & { readonly __resourceTitle: true }

export type ResourceLifecycle =
  | { readonly state: 'active' }
  | { readonly state: 'trashed'; readonly at: number; readonly by: CampaignMemberId }

export type AuditStamp = Readonly<{
  at: number
  by: CampaignMemberId
}>

export type ResourceRecord = Readonly<{
  id: ResourceId
  campaignId: CampaignId
  parentId: ResourceId | null
  kind: ResourceKind
  title: ResourceTitle
  icon: ResourceIcon | null
  color: ResourceColor | null
  lifecycle: ResourceLifecycle
  metadataVersion: VersionStamp
  created: AuditStamp
  updated: AuditStamp
}>

export type ResourceMetadataValue = Readonly<{
  parentId: ResourceId | null
  kind: ResourceKind
  title: ResourceTitle
  icon: ResourceIcon | null
  color: ResourceColor | null
  lifecycle: 'active' | 'trashed'
}>

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return true
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true
    }
  }
  return false
}

function replaceControlRuns(value: string): string {
  let result = ''
  let replacing = false

  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0)!
    const shouldReplace =
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029

    if (shouldReplace) {
      if (!replacing) result += ' '
      replacing = true
    } else {
      result += scalar
      replacing = false
    }
  }

  return result
}

export function canonicalizeResourceTitle(value: string): ResourceTitle {
  if (hasUnpairedSurrogate(value)) throw new TypeError('Resource title contains unpaired UTF-16')
  const normalized = replaceControlRuns(value.normalize('NFC')).trim()
  const title = normalized.length === 0 ? 'Untitled' : normalized
  if (Array.from(title).length > 255) throw new RangeError('Resource title exceeds 255 scalars')
  return title as ResourceTitle
}

export function resourceMetadataValue(record: ResourceRecord): ResourceMetadataValue {
  return {
    parentId: record.parentId,
    kind: record.kind,
    title: record.title,
    icon: record.icon,
    color: record.color,
    lifecycle: record.lifecycle.state,
  }
}
