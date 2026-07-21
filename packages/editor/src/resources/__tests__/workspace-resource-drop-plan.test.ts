import { describe, expect, it } from 'vite-plus/test'
import { assertSha256Digest, initialVersion } from '../component-version'
import { assertDomainId, DOMAIN_ID_KIND } from '../domain-id'
import type { DomainIdByKind, DomainIdKind } from '../domain-id'
import type { AuthorizedResourceSummary, ResourceProjectionScope } from '../resource-index-contract'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { indexRevision, MutableWorkspaceResourceIndex } from '../workspace-resource-index'
import { planWorkspaceResourceDrop } from '../workspace-resource-drop-plan'

const campaignId = id(DOMAIN_ID_KIND.campaign, 1)
const actorId = id(DOMAIN_ID_KIND.campaignMember, 2)
const version = initialVersion(assertSha256Digest('a'.repeat(64)))

function id<TKind extends DomainIdKind>(kind: TKind, sequence: number): DomainIdByKind[TKind] {
  return assertDomainId(kind, `01890f47-f6c8-7a5b-8c9d-${sequence.toString(16).padStart(12, '0')}`)
}

function summary(
  index: number,
  overrides: Partial<AuthorizedResourceSummary> = {},
): AuthorizedResourceSummary {
  return {
    id: id(DOMAIN_ID_KIND.resource, index + 10),
    campaignId,
    displayParentId: null,
    kind: 'note',
    title: canonicalizeResourceTitle(`Resource ${index}`),
    icon: null,
    color: null,
    lifecycle: 'active',
    permission: 'edit',
    metadataVersion: version,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function snapshot(resources: ReadonlyArray<AuthorizedResourceSummary>) {
  const scope: ResourceProjectionScope = {
    campaignId,
    actorId,
    projection: 'dm' as const,
    schema: RESOURCE_INDEX_SCHEMA,
  }
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
  const collections = [...new Set(resources.map((item) => item.displayParentId))].flatMap(
    (parentId) =>
      (['active', 'trashed'] as const).map((lifecycle) => ({
        query: { parentId, lifecycle },
        resourceIds: resources
          .filter((item) => item.displayParentId === parentId && item.lifecycle === lifecycle)
          .map((item) => item.id),
        complete: true,
      })),
  )
  index.replaceSnapshot({
    scope,
    revision: indexRevision('loaded'),
    resources,
    missingResourceIds: [],
    collections,
  })
  return index.getSnapshot()
}

describe('planWorkspaceResourceDrop', () => {
  it('plans the same exact move command that execution can submit', () => {
    const source = summary(1)
    const folder = summary(2, { kind: 'folder', title: canonicalizeResourceTitle('Lore') })

    expect(
      planWorkspaceResourceDrop(
        snapshot([source, folder]),
        { resourceIds: [source.id] },
        { type: 'collection', parentId: folder.id, title: folder.title },
        false,
      ),
    ).toEqual({
      status: 'accepted',
      execution: 'command',
      effect: 'move',
      label: 'Move item to “Lore”',
      command: {
        type: 'move',
        resourceIds: [source.id],
        destinationParentId: folder.id,
      },
    })
  })

  it('atomically restores trashed resources to the chosen location', () => {
    const trashed = summary(1, { lifecycle: 'trashed' })
    const folder = summary(2, {
      kind: 'folder',
      title: canonicalizeResourceTitle('Recovered'),
    })
    const plan = planWorkspaceResourceDrop(
      snapshot([trashed, folder]),
      { resourceIds: [trashed.id] },
      { type: 'collection', parentId: folder.id, title: folder.title },
      false,
    )

    expect(plan).toMatchObject({
      status: 'accepted',
      effect: 'restore',
      command: { type: 'restore', destination: folder.id },
    })
  })

  it('predicts circular drops before execution', () => {
    const folder = summary(1, { kind: 'folder' })
    const child = summary(2, { kind: 'folder', displayParentId: folder.id })

    expect(
      planWorkspaceResourceDrop(
        snapshot([folder, child]),
        { resourceIds: [folder.id] },
        { type: 'collection', parentId: child.id, title: child.title },
        false,
      ),
    ).toEqual({ status: 'rejected', label: 'Cannot move a folder into itself' })
  })

  it('uses a distinct Trash action and accepts an already satisfied move as a no-op', () => {
    const source = summary(1)
    const current = snapshot([source])

    expect(
      planWorkspaceResourceDrop(current, { resourceIds: [source.id] }, { type: 'trash' }, false),
    ).toMatchObject({ status: 'accepted', effect: 'trash', label: 'Trash item' })
    expect(
      planWorkspaceResourceDrop(
        current,
        { resourceIds: [source.id] },
        { type: 'collection', parentId: null, title: 'Campaign' },
        false,
      ),
    ).toEqual({
      status: 'accepted',
      execution: 'noop',
      effect: 'move',
      label: 'Move item to “Campaign”',
    })
  })

  it('accepts dropping a folder onto itself without hiding real hierarchy cycles', () => {
    const folder = summary(1, { kind: 'folder', title: canonicalizeResourceTitle('Lore') })

    expect(
      planWorkspaceResourceDrop(
        snapshot([folder]),
        { resourceIds: [folder.id] },
        { type: 'collection', parentId: folder.id, title: folder.title },
        false,
      ),
    ).toEqual({
      status: 'accepted',
      execution: 'noop',
      effect: 'move',
      label: 'Move item to “Lore”',
    })
  })
})
