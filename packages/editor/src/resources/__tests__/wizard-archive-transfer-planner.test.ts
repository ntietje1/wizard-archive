import { describe, expect, it } from 'vite-plus/test'
import type { CanonicalTargetMapEntry, ResourceCopyMapEntry } from '../content-copy-contract'
import { assertSha256Digest } from '../component-version'
import type { VersionStamp } from '../component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type {
  AssetId,
  CampaignId,
  CanvasNodeId,
  ImportJobId,
  MapPinId,
  NoteBlockId,
  ResourceId,
  SnapshotId,
} from '../domain-id'
import type { PortableRelativePath } from '../portable-path-contract'
import { PORTABLE_PATH_VERSION } from '../portable-path-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { createSourcePathAlias } from '../source-path-alias'
import {
  WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
  WIZARD_ARCHIVE_FILE_SECTION_VERSION,
  WIZARD_ARCHIVE_MAP_SECTION_VERSION,
  WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
  WIZARD_ARCHIVE_SCHEMA_VERSION,
  WIZARD_ARCHIVE_VERSION,
} from '../wizard-archive-contract'
import type { WizardArchiveManifest, WizardArchiveResource } from '../wizard-archive-contract'
import { planWizardArchiveTransfer } from '../wizard-archive-transfer-planner'
import type {
  WizardArchiveContentDomainPlanners,
  WizardArchiveDestination,
} from '../wizard-archive-transfer-planner'

const campaignId = id(DOMAIN_ID_KIND.campaign, 1)
const cloneCampaignId = id(DOMAIN_ID_KIND.campaign, 2)
const foreignCampaignId = id(DOMAIN_ID_KIND.campaign, 3)
const snapshotId = id(DOMAIN_ID_KIND.snapshot, 4)
const importJobId = id(DOMAIN_ID_KIND.importJob, 5)
const folderId = id(DOMAIN_ID_KIND.resource, 10)
const noteId = id(DOMAIN_ID_KIND.resource, 11)
const fileId = id(DOMAIN_ID_KIND.resource, 12)
const mapId = id(DOMAIN_ID_KIND.resource, 13)
const canvasId = id(DOMAIN_ID_KIND.resource, 14)
const deletedId = id(DOMAIN_ID_KIND.resource, 15)
const blockId = id(DOMAIN_ID_KIND.noteBlock, 20)
const assetId = id(DOMAIN_ID_KIND.asset, 21)
const pinId = id(DOMAIN_ID_KIND.mapPin, 22)
const nodeId = id(DOMAIN_ID_KIND.canvasNode, 23)
const clonedBlockId = id(DOMAIN_ID_KIND.noteBlock, 30)
const clonedAssetId = id(DOMAIN_ID_KIND.asset, 31)
const clonedPinId = id(DOMAIN_ID_KIND.mapPin, 32)
const clonedNodeId = id(DOMAIN_ID_KIND.canvasNode, 33)

describe('Wizard Archive transfer planner', () => {
  it('uses the exact four version relations for every content kind', async () => {
    const manifest = fixture()
    const cases = [
      {
        relation: 'equal',
        destination: (imported: VersionStamp) => ({ ...imported, revision: imported.revision + 2 }),
        action: 'retain_equal_frontier',
      },
      {
        relation: 'import_newer',
        destination: (imported: VersionStamp) => stamp(imported.revision - 1, '8'),
        action: 'use_package',
      },
      {
        relation: 'destination_newer',
        destination: (imported: VersionStamp) => stamp(imported.revision + 1, '8'),
        action: 'keep_destination',
      },
      {
        relation: 'unknown',
        destination: (imported: VersionStamp) => stamp(imported.revision, '8'),
        action: undefined,
      },
    ] as const

    for (const resourceId of [noteId, fileId, mapId, canvasId]) {
      const imported = manifest.resources.find((candidate) => candidate.id === resourceId)!
      for (const fixtureCase of cases) {
        const destination = existingDestination(manifest)
        destination.resources = destination.resources.map((candidate) =>
          candidate.resourceId === resourceId
            ? { ...candidate, contentVersion: fixtureCase.destination(imported.contentVersion!) }
            : candidate,
        )
        const result = await planWizardArchiveTransfer(
          manifest,
          destination,
          contentPlanners(),
          resourceAllocator(100),
        )
        expect(result.status, `${resourceId}:${fixtureCase.relation}`).toBe('planned')
        if (result.status !== 'planned') continue
        expect(actionFor(result.plan.actions, resourceId, 'content')).toBe(fixtureCase.action)
        expect(
          result.plan.unknownDecisions.some(
            (group) =>
              group.resourceId === resourceId &&
              group.components.some((component) => component.component === 'content'),
          ),
        ).toBe(fixtureCase.relation === 'unknown')
      }
    }
  })

  it('compares metadata and every owning content domain independently', async () => {
    const manifest = fixture()
    const destination: WizardArchiveDestination = {
      state: 'existing',
      campaignId,
      authorizedRestoreResourceIds: [],
      tombstones: [],
      resources: [
        destinationResource(folderId, 'folder', stamp(4, 'a'), null),
        destinationResource(noteId, 'note', stamp(1, '9'), stamp(4, '9')),
        destinationResource(fileId, 'file', stamp(4, '9'), stamp(1, '9')),
        destinationResource(mapId, 'map', stamp(2, '9'), stamp(5, 'd')),
        destinationResource(canvasId, 'canvas', stamp(2, 'e'), stamp(2, '9')),
      ],
    }

    const result = await planWizardArchiveTransfer(
      manifest,
      destination,
      contentPlanners(),
      resourceAllocator(100),
    )

    expect(result.status).toBe('planned')
    if (result.status !== 'planned') return
    expect(actionFor(result.plan.actions, folderId, 'metadata')).toBe('retain_equal_frontier')
    expect(actionFor(result.plan.actions, noteId, 'metadata')).toBe('use_package')
    expect(actionFor(result.plan.actions, noteId, 'content')).toBe('keep_destination')
    expect(actionFor(result.plan.actions, fileId, 'metadata')).toBe('keep_destination')
    expect(actionFor(result.plan.actions, fileId, 'content')).toBe('use_package')
    expect(actionFor(result.plan.actions, mapId, 'content')).toBe('retain_equal_frontier')
    expect(result.plan.unknownDecisions).toEqual([
      expect.objectContaining({
        resourceId: mapId,
        components: [expect.objectContaining({ component: 'metadata' })],
      }),
      expect.objectContaining({
        resourceId: canvasId,
        components: [expect.objectContaining({ component: 'content' })],
      }),
    ])
    expect(result.plan.unknownDecisions[0]!.components[0]!.supportedActions).toEqual([
      'keep_destination',
      'use_package',
      'recover_as_new',
    ])
    expect(result.plan.resourceWrites).toEqual([
      expect.objectContaining({
        sourceResourceId: noteId,
        writeMetadata: true,
        writeContent: false,
      }),
      expect.objectContaining({
        sourceResourceId: fileId,
        writeMetadata: false,
        writeContent: true,
      }),
    ])
    expect(result.plan.aliases).toHaveLength(2)
    expect(result.plan.assetsFolder).toEqual({ action: 'preserve_destination' })
  })

  it('recovers an unknown imported resource under one fresh resource map', async () => {
    const manifest = fixture()
    const recoveredId = id(DOMAIN_ID_KIND.resource, 100)
    const destination = existingDestination(manifest)
    destination.resources = destination.resources.map((candidate) =>
      candidate.resourceId === mapId ? { ...candidate, metadataVersion: stamp(2, '9') } : candidate,
    )

    const result = await planWizardArchiveTransfer(
      manifest,
      destination,
      contentPlanners(),
      () => recoveredId,
      [{ resourceId: mapId, component: 'metadata', action: 'recover_as_new' }],
    )

    expect(result.status).toBe('planned')
    if (result.status !== 'planned') return
    expect(result.plan.resourceMap).toEqual([{ sourceId: mapId, destinationId: recoveredId }])
    expect(result.plan.resourceWrites).toContainEqual(
      expect.objectContaining({
        sourceResourceId: mapId,
        destinationResourceId: recoveredId,
        writeMetadata: true,
        writeContent: true,
        metadataVersion: expect.objectContaining({ revision: 1 }),
      }),
    )
    expect(result.plan.aliases).toContainEqual(expect.objectContaining({ resourceId: recoveredId }))
    expect(result.plan.actions.filter((action) => action.resourceId === mapId)).toEqual([
      expect.objectContaining({ action: 'recover_as_new', source: 'policy' }),
    ])
  })

  it('does not restore past a newer tombstone and authorizes same-id restoration', async () => {
    const manifest = oneNoteFixture(stamp(5, 'a'))
    const newerDeletion = {
      resourceId: noteId,
      campaignId,
      deletionVersion: stamp(6, 'f'),
      deletedAt: 10,
    }
    const stale = await planWizardArchiveTransfer(
      manifest,
      {
        state: 'existing',
        campaignId,
        resources: [],
        tombstones: [newerDeletion],
        authorizedRestoreResourceIds: [],
      },
      contentPlanners(),
      resourceAllocator(100),
    )
    expect(stale).toEqual(
      expect.objectContaining({
        status: 'planned',
        plan: expect.objectContaining({ resourceWrites: [] }),
      }),
    )

    const olderDeletion = { ...newerDeletion, deletionVersion: stamp(4, 'f') }
    const unauthorized = await planWizardArchiveTransfer(
      manifest,
      {
        state: 'existing',
        campaignId,
        resources: [],
        tombstones: [olderDeletion],
        authorizedRestoreResourceIds: [],
      },
      contentPlanners(),
      resourceAllocator(100),
    )
    expect(unauthorized).toEqual({ status: 'rejected', reason: 'restore_unauthorized' })

    const authorized = await planWizardArchiveTransfer(
      manifest,
      {
        state: 'existing',
        campaignId,
        resources: [],
        tombstones: [olderDeletion],
        authorizedRestoreResourceIds: [noteId],
      },
      contentPlanners(),
      resourceAllocator(100),
    )
    expect(authorized).toEqual(
      expect.objectContaining({
        status: 'planned',
        plan: expect.objectContaining({
          resourceWrites: [expect.objectContaining({ destinationResourceId: noteId })],
        }),
      }),
    )
  })

  it('offers policy only for unknown deletion relations', async () => {
    const manifest = oneNoteFixture(stamp(5, 'a'))
    const result = await planWizardArchiveTransfer(
      manifest,
      {
        state: 'existing',
        campaignId,
        resources: [],
        tombstones: [
          { resourceId: noteId, campaignId, deletionVersion: stamp(5, 'f'), deletedAt: 10 },
        ],
        authorizedRestoreResourceIds: [],
      },
      contentPlanners(),
      resourceAllocator(100),
    )

    expect(result).toEqual(
      expect.objectContaining({
        status: 'planned',
        plan: expect.objectContaining({
          unknownDecisions: [
            {
              resourceId: noteId,
              components: [
                expect.objectContaining({
                  component: 'deletion',
                  supportedActions: ['keep_destination', 'use_package', 'recover_as_new'],
                }),
              ],
            },
          ],
        }),
      }),
    )
  })

  it('clones every live identity, hierarchy, alias, role, and referenceable target', async () => {
    const manifest = fixture()
    const result = await planWizardArchiveTransfer(
      manifest,
      { state: 'new', campaignId: cloneCampaignId },
      contentPlanners(),
      resourceAllocator(200),
    )

    expect(result.status).toBe('planned')
    if (result.status !== 'planned') return
    expect(result.plan.mode).toBe('new_campaign_clone')
    expect(result.plan.resourceMap).toHaveLength(manifest.resources.length)
    expect(result.plan.resourceMap.every((entry) => entry.sourceId !== entry.destinationId)).toBe(
      true,
    )
    const folderClone = result.plan.resourceMap.find((entry) => entry.sourceId === folderId)!
    const noteClone = result.plan.resourceWrites.find(
      (candidate) => candidate.sourceResourceId === noteId,
    )!
    expect(noteClone).toEqual(
      expect.objectContaining({
        parentId: folderClone.destinationId,
        metadataVersion: expect.objectContaining({ revision: 1 }),
        writeMetadata: true,
        writeContent: true,
      }),
    )
    expect(
      result.plan.resourceWrites.find((candidate) => candidate.sourceResourceId === mapId),
    ).toEqual(expect.objectContaining({ lifecycle: 'trashed' }))
    expect(result.plan.targetMap).toHaveLength(9)
    expect(result.plan.contentPlans).toHaveLength(4)
    expect(result.plan.contentPlans.find((plan) => plan.domain === 'note')).toEqual(
      expect.objectContaining({
        plan: expect.objectContaining({
          prepared: expect.objectContaining({
            initialContentRevision: 1,
            freshDestinationResourceIds: expect.arrayContaining([noteClone.destinationResourceId]),
          }),
        }),
      }),
    )
    expect(result.plan.aliases[0]).toEqual(
      expect.objectContaining({
        campaignId: cloneCampaignId,
        resourceId: noteClone.destinationResourceId,
      }),
    )
    expect(result.plan.assetsFolder).toEqual(
      expect.objectContaining({
        action: 'replace_for_new_campaign',
        value: folderClone.destinationId,
      }),
    )
    expect(result.plan.unknownDecisions).toEqual([])
    expect(result.plan.actions.some((action) => action.component === 'deletion')).toBe(false)
  })

  it('rejects foreign existing campaigns, selected scope, and unrelated policy', async () => {
    const manifest = fixture()
    await expect(
      planWizardArchiveTransfer(
        manifest,
        {
          state: 'existing',
          campaignId: foreignCampaignId,
          resources: [],
          tombstones: [],
          authorizedRestoreResourceIds: [],
        },
        contentPlanners(),
        resourceAllocator(100),
      ),
    ).resolves.toEqual({
      status: 'rejected',
      reason: 'foreign_campaign_destination_unsupported',
    })
    await expect(
      planWizardArchiveTransfer(
        { ...manifest, scope: 'selected_resources' } as unknown as WizardArchiveManifest,
        { state: 'new', campaignId: cloneCampaignId },
        contentPlanners(),
        resourceAllocator(100),
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_package_scope' })
    await expect(
      planWizardArchiveTransfer(
        manifest,
        existingDestination(manifest),
        contentPlanners(),
        resourceAllocator(100),
        [{ resourceId: noteId, component: 'metadata', action: 'use_package' }],
      ),
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid_policy' })
  })
})

function fixture(): WizardArchiveManifest {
  const resources: Array<WizardArchiveResource> = [
    archiveResource(folderId, null, 'folder', stamp(2, 'a'), null, 'Folder'),
    archiveResource(noteId, folderId, 'note', stamp(2, 'b'), stamp(2, 'c'), 'Shared'),
    archiveResource(fileId, null, 'file', stamp(2, 'b'), stamp(2, 'c'), 'Shared'),
    archiveResource(mapId, null, 'map', stamp(2, 'b'), stamp(5, 'd'), 'Map', 'trashed'),
    archiveResource(canvasId, null, 'canvas', stamp(2, 'e'), stamp(2, 'f'), 'Canvas'),
  ]
  return {
    version: WIZARD_ARCHIVE_VERSION,
    schemaVersion: WIZARD_ARCHIVE_SCHEMA_VERSION,
    scope: 'full_campaign',
    sourceCampaignId: campaignId,
    transferSnapshotId: snapshotId,
    portablePathVersion: PORTABLE_PATH_VERSION,
    resources,
    tombstones: [
      { resourceId: deletedId, campaignId, deletionVersion: stamp(3, '1'), deletedAt: 1 },
    ],
    aliases: [
      createSourcePathAlias({
        campaignId,
        resourceId: noteId,
        importJobId,
        sourceRootId: 'upload',
        rawPath: 'notes/shared.md',
      }),
      createSourcePathAlias({
        campaignId,
        resourceId: mapId,
        importJobId,
        sourceRootId: 'upload',
        rawPath: 'maps/map.wizardmap',
      }),
    ],
    assetsFolderId: folderId,
    sections: {
      notes: {
        version: WIZARD_ARCHIVE_NOTE_SECTION_VERSION,
        entries: [
          {
            resourceId: noteId,
            blockIds: [blockId],
            destinations: [{ kind: 'internal', target: { kind: 'resource', resourceId: fileId } }],
          },
        ],
      },
      files: {
        version: WIZARD_ARCHIVE_FILE_SECTION_VERSION,
        entries: [
          {
            resourceId: fileId,
            assetId,
            classification: 'inert_file',
            byteSize: 1,
            detectedFormat: null,
            extension: 'bin',
            mediaType: 'application/octet-stream',
            viewerUnavailableReason: 'unsupported_format',
            destinations: [],
          },
        ],
      },
      maps: {
        version: WIZARD_ARCHIVE_MAP_SECTION_VERSION,
        entries: [{ resourceId: mapId, pinIds: [pinId], destinations: [] }],
      },
      canvases: {
        version: WIZARD_ARCHIVE_CANVAS_SECTION_VERSION,
        entries: [{ resourceId: canvasId, nodeIds: [nodeId], destinations: [] }],
      },
    },
  }
}

function oneNoteFixture(metadataVersion: VersionStamp): WizardArchiveManifest {
  const manifest = fixture()
  return {
    ...manifest,
    resources: [archiveResource(noteId, null, 'note', metadataVersion, stamp(1, 'c'), 'Note')],
    tombstones: [],
    aliases: [],
    assetsFolderId: null,
    sections: {
      ...manifest.sections,
      notes: {
        ...manifest.sections.notes,
        entries: [{ resourceId: noteId, blockIds: [blockId], destinations: [] }],
      },
      files: { ...manifest.sections.files, entries: [] },
      maps: { ...manifest.sections.maps, entries: [] },
      canvases: { ...manifest.sections.canvases, entries: [] },
    },
  }
}

function archiveResource(
  resourceId: ResourceId,
  parentId: ResourceId | null,
  kind: WizardArchiveResource['kind'],
  metadataVersion: VersionStamp,
  contentVersion: VersionStamp | null,
  title: string,
  lifecycle: WizardArchiveResource['lifecycle'] = 'active',
): WizardArchiveResource {
  return {
    id: resourceId,
    parentId,
    kind,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle,
    metadataVersion,
    contentVersion,
    artifact:
      kind === 'folder'
        ? { kind: 'directory', path: title as PortableRelativePath }
        : {
            kind: 'file',
            path: `${title}-${resourceId}.bin` as PortableRelativePath,
            mediaType: 'application/octet-stream',
            byteSize: 1,
            digest: contentVersion!.digest,
          },
  }
}

function existingDestination(manifest: WizardArchiveManifest) {
  return {
    state: 'existing' as const,
    campaignId,
    authorizedRestoreResourceIds: [] as Array<ResourceId>,
    tombstones: [] as WizardArchiveManifest['tombstones'],
    resources: manifest.resources.map((candidate) =>
      destinationResource(
        candidate.id,
        candidate.kind,
        candidate.metadataVersion,
        candidate.contentVersion,
      ),
    ),
  }
}

function destinationResource(
  resourceId: ResourceId,
  kind: WizardArchiveResource['kind'],
  metadataVersion: VersionStamp,
  contentVersion: VersionStamp | null,
) {
  return { resourceId, campaignId, kind, metadataVersion, contentVersion }
}

function contentPlanners(): WizardArchiveContentDomainPlanners {
  return {
    notes: {
      prepare(input) {
        const referenceableTargets = input.entries.flatMap((entry) =>
          entry.blockIds.flatMap((sourceBlockId) =>
            (['block', 'heading'] as const).map((presentation) => ({
              source: {
                kind: 'noteBlock' as const,
                resourceId: entry.resourceId,
                blockId: sourceBlockId,
                presentation,
              },
              destination: {
                kind: 'noteBlock' as const,
                resourceId: destinationResourceId(input.resourceMap, entry.resourceId),
                blockId: input.mode === 'new_campaign_clone' ? clonedBlockId : sourceBlockId,
                presentation,
              },
            })),
          ),
        )
        return {
          opaque: {
            entries: input.entries,
            freshDestinationResourceIds: input.freshDestinationResourceIds,
            initialContentRevision: input.initialContentRevision,
          },
          referenceableTargets,
        }
      },
      finalize(prepared, targetMap) {
        return { prepared, targetMap }
      },
    },
    files: {
      prepare(input) {
        return {
          opaque: {
            entries: input.entries,
            assetMap: input.entries.map((entry) => ({
              source: entry.assetId,
              destination: input.mode === 'new_campaign_clone' ? clonedAssetId : entry.assetId,
            })),
          },
          referenceableTargets: [],
        }
      },
      finalize(prepared, targetMap) {
        return { prepared, targetMap }
      },
    },
    maps: localTargetPlanner('mapPin', clonedPinId),
    canvases: localTargetPlanner('canvasNode', clonedNodeId),
  }
}

function localTargetPlanner(
  kind: 'mapPin',
  clonedId: MapPinId,
): WizardArchiveContentDomainPlanners['maps']
function localTargetPlanner(
  kind: 'canvasNode',
  clonedId: CanvasNodeId,
): WizardArchiveContentDomainPlanners['canvases']
function localTargetPlanner(
  kind: 'mapPin' | 'canvasNode',
  clonedId: MapPinId | CanvasNodeId,
): WizardArchiveContentDomainPlanners['maps'] | WizardArchiveContentDomainPlanners['canvases'] {
  return {
    prepare(input) {
      const referenceableTargets: Array<CanonicalTargetMapEntry> = input.entries.flatMap(
        (entry) => {
          const localIds = 'pinIds' in entry ? entry.pinIds : entry.nodeIds
          return localIds.map((localId) => ({
            source:
              kind === 'mapPin'
                ? { kind, resourceId: entry.resourceId, pinId: localId as MapPinId }
                : { kind, resourceId: entry.resourceId, nodeId: localId as CanvasNodeId },
            destination:
              kind === 'mapPin'
                ? {
                    kind,
                    resourceId: destinationResourceId(input.resourceMap, entry.resourceId),
                    pinId: (input.mode === 'new_campaign_clone' ? clonedId : localId) as MapPinId,
                  }
                : {
                    kind,
                    resourceId: destinationResourceId(input.resourceMap, entry.resourceId),
                    nodeId: (input.mode === 'new_campaign_clone'
                      ? clonedId
                      : localId) as CanvasNodeId,
                  },
          }))
        },
      )
      return {
        opaque: {
          entries: input.entries,
          freshDestinationResourceIds: input.freshDestinationResourceIds,
          initialContentRevision: input.initialContentRevision,
        },
        referenceableTargets,
      }
    },
    finalize(prepared, targetMap) {
      return { prepared, targetMap }
    },
  } as WizardArchiveContentDomainPlanners['maps'] & WizardArchiveContentDomainPlanners['canvases']
}

function destinationResourceId(
  resourceMap: ReadonlyArray<ResourceCopyMapEntry>,
  sourceId: ResourceId,
): ResourceId {
  return resourceMap.find((entry) => entry.sourceId === sourceId)!.destinationId
}

function actionFor(
  actions: ReadonlyArray<{ resourceId: ResourceId; component: string; action: string }>,
  resourceId: ResourceId,
  component: string,
) {
  return actions.find(
    (candidate) => candidate.resourceId === resourceId && candidate.component === component,
  )?.action
}

function resourceAllocator(start: number) {
  let current = start
  return () => id(DOMAIN_ID_KIND.resource, current++)
}

function stamp(revision: number, digestCharacter: string): VersionStamp {
  return {
    scheme: 'authoritative-revision-v1',
    revision,
    digest: assertSha256Digest(digestCharacter.repeat(64)),
  }
}

function id(kind: typeof DOMAIN_ID_KIND.resource, value: number): ResourceId
function id(kind: typeof DOMAIN_ID_KIND.campaign, value: number): CampaignId
function id(kind: typeof DOMAIN_ID_KIND.snapshot, value: number): SnapshotId
function id(kind: typeof DOMAIN_ID_KIND.importJob, value: number): ImportJobId
function id(kind: typeof DOMAIN_ID_KIND.noteBlock, value: number): NoteBlockId
function id(kind: typeof DOMAIN_ID_KIND.asset, value: number): AssetId
function id(kind: typeof DOMAIN_ID_KIND.mapPin, value: number): MapPinId
function id(kind: typeof DOMAIN_ID_KIND.canvasNode, value: number): CanvasNodeId
function id<T extends (typeof DOMAIN_ID_KIND)[keyof typeof DOMAIN_ID_KIND]>(
  kind: T,
  value: number,
) {
  return assertDomainId(kind, `01890f40-f6c8-7a5b-8c9d-${value.toString(16).padStart(12, '0')}`)
}
