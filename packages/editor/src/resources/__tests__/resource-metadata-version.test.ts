import { describe, expect, it } from 'vite-plus/test'
import { assertSha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import {
  createResourceTombstone,
  digestResourceMetadata,
  encodeResourceMetadata,
  encodeResourceTombstone,
  initialResourceMetadataVersion,
} from '../resource-metadata-version'
import { RESOURCE_KIND, canonicalizeResourceTitle } from '../resource-contract'

const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789ab')
const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, '01890f47-f6c8-7a5b-8c9d-0123456789ac')
const metadata = {
  parentId: null,
  kind: RESOURCE_KIND.note,
  title: canonicalizeResourceTitle('Session Notes'),
  icon: 'Notebook',
  color: '#abcdef',
  lifecycle: 'active',
} as const

describe('resource metadata versions and tombstones', () => {
  it('freezes the exact resource-metadata-v1 bytes and digest', async () => {
    expect(new TextDecoder().decode(encodeResourceMetadata(metadata))).toBe(
      '{"parentId":null,"kind":"note","title":"Session Notes","icon":"Notebook","color":"#abcdef","lifecycle":"active"}',
    )
    await expect(digestResourceMetadata(metadata)).resolves.toBe(
      'a5a83d4d92c6c58d8001092da00b14293dc769bdfa283184b0259b31ae777616',
    )
  })

  it('starts metadata at revision one', async () => {
    await expect(initialResourceMetadataVersion(metadata)).resolves.toEqual({
      scheme: 'authoritative-revision-v1',
      revision: 1,
      digest: await digestResourceMetadata(metadata),
    })
  })

  it('creates a successor tombstone version from fixed tombstone bytes', async () => {
    expect(new TextDecoder().decode(encodeResourceTombstone(resourceId, campaignId))).toBe(
      `{"resourceId":"${resourceId}","campaignId":"${campaignId}","state":"deleted"}`,
    )
    const tombstone = await createResourceTombstone(
      resourceId,
      campaignId,
      {
        scheme: 'authoritative-revision-v1',
        revision: 7,
        digest: assertSha256Digest('a'.repeat(64)),
      },
      123,
    )

    expect(tombstone.resourceId).toBe(resourceId)
    expect(tombstone.campaignId).toBe(campaignId)
    expect(tombstone.deletionVersion.revision).toBe(8)
    expect(tombstone.deletedAt).toBe(123)
  })
})
