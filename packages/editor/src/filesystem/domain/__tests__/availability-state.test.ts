import { testResourceId } from '../../../../../../shared/test/resource-id'
import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_STATUS } from '../../../workspace/items-persistence-contract'
import { createResourceCatalogModel } from '../../catalog'
import type { AnyItem } from '../../../workspace/items'

import type { NoteItemWithContent } from '../../../notes/item-contract'
import {
  createResourceAvailabilityMetadataSource,
  resolveResourceAvailabilityState,
} from '../availability-state'
import type { EditorWorkspaceActor } from '../permission-resolution'
import { createNote } from '../../../test/sidebar-item-factory'
import { testDomainId } from '../../../test/domain-id'
import { DOMAIN_ID_KIND } from '../../../resources/domain-id'

const memberId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'member_test')

const ownerActor: EditorWorkspaceActor = { kind: 'owner' }
const ownerViewAsActor: EditorWorkspaceActor = { kind: 'owner_view_as', participantId: memberId }
const participantActor: EditorWorkspaceActor = { kind: 'participant' }
type ResourceAvailabilityMetadataSource = ReturnType<
  typeof createResourceAvailabilityMetadataSource
>

describe('resolveResourceAvailabilityState', () => {
  it('returns available content when the active actor can view the readable item', () => {
    const readableItem = createReadableNote({ id: noteId('note-1'), name: 'Secret Note' })
    const state = resolveResourceAvailabilityState({
      resourceId: readableItem.id,
      metadataSource: createMetadataSource([readableItem]),
      readableItem,
      actor: ownerActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: true,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'available',
      item: readableItem,
      label: 'Secret Note',
    })
  })

  it('returns trashed content when the visible item is in the trash', () => {
    const readableItem = createReadableNote({
      id: noteId('note-1'),
      name: 'Secret Note',
      status: RESOURCE_STATUS.trashed,
    })
    const state = resolveResourceAvailabilityState({
      resourceId: readableItem.id,
      metadataSource: createMetadataSource([readableItem]),
      readableItem,
      actor: ownerActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: true,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'trashed',
      label: 'Secret Note',
      message: 'This item is in the trash.',
    })
  })

  it('uses metadata to explain view-as sharing gaps for pages', () => {
    const metadata = createNote({
      id: noteId('note-1'),
      name: 'Secret Note',
      slug: 'secret-note',
    })
    const readableItem = createReadableNote({
      ...metadata,
      allPermissionLevel: PERMISSION_LEVEL.NONE,
      shares: [],
    })
    const state = resolveResourceAvailabilityState({
      resourceId: metadata.id,
      metadataSource: createMetadataSource([metadata]),
      readableItem,
      actor: ownerViewAsActor,
      accessTargetLabel: 'Mina',
      isDirectMessageActor: true,
      subject: 'page',
      fallbackLabel: 'Page',
    })

    expect(state).toMatchObject({
      status: 'not_shared',
      label: 'Secret Note',
      message: "This page isn't shared with Mina.",
    })
  })

  it('uses known metadata to explain view-as sharing gaps for pages', () => {
    const metadata = createNote({
      id: noteId('note-hidden-from-viewed-player'),
      name: 'Secret Note',
      slug: 'secret-note',
      allPermissionLevel: null,
      shares: [],
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [metadata],
      trashItems: [],
      visibleActiveItems: [],
    })
    const state = resolveResourceAvailabilityState({
      resourceId: metadata.id,
      metadataSource: createResourceAvailabilityMetadataSource({
        catalog,
        load: { activeStatus: 'success' },
      }),
      readableItem: null,
      actor: ownerViewAsActor,
      accessTargetLabel: 'Mina',
      isDirectMessageActor: true,
      subject: 'page',
      fallbackLabel: 'Page',
    })

    expect(state).toMatchObject({
      status: 'not_shared',
      label: 'Secret Note',
      message: "This page isn't shared with Mina.",
    })
  })

  it('resolves missing pages for direct-message editors as not found', () => {
    const state = resolveResourceAvailabilityState({
      resourceId: noteId('missing'),
      metadataSource: createMetadataSource([]),
      readableItem: null,
      actor: ownerActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: true,
      subject: 'page',
      fallbackLabel: 'Page',
    })

    expect(state).toMatchObject({
      status: 'not_found',
      message: "This page doesn't exist.",
    })
  })

  it('resolves missing player targets through the generic not-found fallback', () => {
    const state = resolveResourceAvailabilityState({
      resourceId: noteId('missing'),
      metadataSource: createMetadataSource([]),
      readableItem: null,
      actor: participantActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: false,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'not_found',
      message: "This item doesn't exist.",
    })
  })

  it('hides unavailable player metadata behind the generic not-found fallback', () => {
    const hidden = createNote({
      id: noteId('hidden-note'),
      name: 'Secret Note',
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [hidden],
      trashItems: [],
      visibleActiveItems: [],
    })
    const state = resolveResourceAvailabilityState({
      resourceId: hidden.id,
      metadataSource: createResourceAvailabilityMetadataSource({
        catalog,
        load: { activeStatus: 'success' },
      }),
      readableItem: null,
      actor: participantActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: false,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'not_found',
      label: 'Embedded item',
      message: "This item doesn't exist.",
    })
  })

  it('hides unreadable loaded player targets behind the generic not-found fallback', () => {
    const hidden = createReadableNote({
      id: noteId('loaded-hidden-note'),
      name: 'Secret Note',
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [hidden],
      trashItems: [],
      visibleActiveItems: [],
    })
    const state = resolveResourceAvailabilityState({
      resourceId: hidden.id,
      metadataSource: createResourceAvailabilityMetadataSource({
        catalog,
        load: { activeStatus: 'success' },
      }),
      readableItem: hidden,
      actor: participantActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: false,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'not_found',
      label: 'Embedded item',
      message: "This item doesn't exist.",
    })
  })

  it('keeps the loaded item label while content is pending', () => {
    const metadata = createNote({
      id: noteId('note-1'),
      name: 'Secret Note',
      slug: 'secret-note',
    })
    const state = resolveResourceAvailabilityState({
      resourceId: metadata.id,
      metadataSource: createMetadataSource([metadata], 'pending'),
      readableItem: null,
      readableItemLoading: true,
      actor: ownerActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: true,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'loading',
      label: 'Secret Note',
    })
  })

  it('reports readable item errors before metadata load state', () => {
    const state = resolveResourceAvailabilityState({
      resourceId: noteId('note-1'),
      metadataSource: createMetadataSource([], 'pending'),
      readableItem: null,
      readableItemError: new Error('fetch failed'),
      actor: ownerActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: true,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'error',
      message: 'Failed to load item: fetch failed',
    })
  })

  it('reports falsy readable item error payloads before missing-state fallbacks', () => {
    const state = resolveResourceAvailabilityState({
      resourceId: noteId('note-1'),
      metadataSource: createMetadataSource([], 'success'),
      readableItem: null,
      readableItemError: '',
      actor: ownerActor,
      accessTargetLabel: 'you',
      isDirectMessageActor: true,
      subject: 'item',
      fallbackLabel: 'Embedded item',
    })

    expect(state).toMatchObject({
      status: 'error',
      message: 'Failed to load item: ',
    })
  })
})

function createReadableNote(overrides: Parameters<typeof createNote>[0] = {}): NoteItemWithContent {
  return {
    ...createNote(overrides),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
  }
}

function noteId(value: string) {
  return testResourceId(value)
}

function createMetadataSource(
  items: Array<AnyItem>,
  status: ResourceAvailabilityMetadataSource['status'] = 'success',
): ResourceAvailabilityMetadataSource {
  const itemsById = new Map<ResourceId, AnyItem>(items.map((item) => [item.id, item]))
  return {
    directMessage: {
      getItemById: (itemId) => itemsById.get(itemId) ?? null,
    },
    player: {
      getItemById: (itemId) => itemsById.get(itemId) ?? null,
    },
    status,
  }
}
