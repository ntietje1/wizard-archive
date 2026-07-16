import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

export type YjsUpdateOutbox = Readonly<{
  clear(): void
  load(): Uint8Array | null
  replace(update: Uint8Array): void
}>

export function createYjsUpdateOutbox(
  kind: 'canvas' | 'note',
  campaignId: CampaignId,
  resourceId: ResourceId,
  memberId: CampaignMemberId,
): YjsUpdateOutbox {
  const key = `wizard-archive:${kind}-update-outbox:v1:${memberId}:${campaignId}:${resourceId}`
  return {
    clear: () => sessionStorage.removeItem(key),
    load: () => {
      const encoded = sessionStorage.getItem(key)
      if (encoded === null) return null
      try {
        return decodeBase64(encoded)
      } catch {
        sessionStorage.removeItem(key)
        return null
      }
    },
    replace: (update) => sessionStorage.setItem(key, encodeBase64(update)),
  }
}

function encodeBase64(update: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < update.byteLength; offset += 8192) {
    binary += String.fromCharCode(...update.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
