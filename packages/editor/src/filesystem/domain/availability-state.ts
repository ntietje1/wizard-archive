import type { SidebarItemId } from '../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { FileSystemLoadState } from '../load-state'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
import type { ResourceSlug } from '../../workspace/resource-contract'
import { isTrashedSidebarItem } from '../../workspace/items/status'
import { actorHasResourcePermission } from './permission-resolution'
import type { EditorWorkspaceActor } from './permission-resolution'

export type ResourceAvailabilityState =
  | {
      status: 'loading'
      label: string
      item?: undefined
      message?: undefined
    }
  | {
      status: 'available'
      label: string
      item: AnyItemWithContent
      message?: undefined
    }
  | {
      status: 'not_found'
      label: string
      item?: undefined
      message: string
    }
  | {
      status: 'trashed' | 'not_shared' | 'error'
      label: string
      item?: undefined
      message: string
    }

type ResourceAvailabilitySubject = 'item' | 'page'

type ResourceAvailabilityLookup =
  | { kind: 'id'; id: SidebarItemId | null | undefined }
  | { kind: 'slug'; slug: string | null | undefined }

interface ResourceAvailabilityMetadataLookup {
  getItemById: (itemId: SidebarItemId) => AnyItem | null | undefined
  getItemBySlug: (slug: string) => AnyItem | null | undefined
}

interface ResourceAvailabilityMetadataSource {
  directMessage: ResourceAvailabilityMetadataLookup
  player: ResourceAvailabilityMetadataLookup
  status: 'pending' | 'error' | 'success'
}

type ResourceAvailabilityCatalog = {
  getKnownItemById: (itemId: SidebarItemId) => AnyItem | null | undefined
  getKnownItemBySlug: (slug: ResourceSlug) => AnyItem | null | undefined
  getVisibleItemById: (itemId: SidebarItemId) => AnyItem | null | undefined
  getVisibleItemBySlug: (slug: ResourceSlug) => AnyItem | null | undefined
}

export function createResourceAvailabilityMetadataSource(input: {
  catalog: ResourceAvailabilityCatalog
  load: Pick<FileSystemLoadState, 'activeStatus'>
}): ResourceAvailabilityMetadataSource {
  return {
    directMessage: {
      getItemById: input.catalog.getKnownItemById,
      getItemBySlug: (slug) => input.catalog.getKnownItemBySlug(slug as ResourceSlug),
    },
    player: {
      getItemById: input.catalog.getVisibleItemById,
      getItemBySlug: (slug) => input.catalog.getVisibleItemBySlug(slug as ResourceSlug),
    },
    status: input.load.activeStatus,
  }
}

export function resolveResourceAvailabilityState({
  lookup,
  metadataSource,
  readableItem,
  readableItemLoading = false,
  readableItemError,
  actor,
  accessTargetLabel,
  isDirectMessageActor,
  subject,
  fallbackLabel,
}: {
  lookup: ResourceAvailabilityLookup
  metadataSource: ResourceAvailabilityMetadataSource
  readableItem: AnyItemWithContent | null | undefined
  readableItemLoading?: boolean
  readableItemError?: unknown
  actor: EditorWorkspaceActor | null
  accessTargetLabel: string
  isDirectMessageActor: boolean
  subject: ResourceAvailabilitySubject
  fallbackLabel: string
}): ResourceAvailabilityState {
  const metadataLookup = isDirectMessageActor ? metadataSource.directMessage : metadataSource.player
  const metadata = findAvailabilityMetadata(lookup, metadataLookup)
  const actorCanViewReadableItem =
    !!readableItem &&
    actorHasResourcePermission(readableItem, PERMISSION_LEVEL.VIEW, {
      actor,
      getItemById: metadataLookup.getItemById,
    })
  const label = metadata?.name ?? (actorCanViewReadableItem ? readableItem.name : fallbackLabel)

  if (readableItem && actorCanViewReadableItem && isTrashedSidebarItem(readableItem)) {
    return {
      status: 'trashed',
      label,
      message: `This ${subject} is in the trash.`,
    }
  }

  if (readableItem && actorCanViewReadableItem) {
    return {
      status: 'available',
      item: readableItem,
      label,
    }
  }

  if (readableItemError !== null && readableItemError !== undefined) {
    return {
      status: 'error',
      label,
      message: `Failed to load ${subject}: ${getErrorMessage(readableItemError)}`,
    }
  }

  if (readableItemLoading || metadataSource.status === 'pending') {
    return {
      status: 'loading',
      label,
    }
  }

  if (metadata) {
    return {
      status: 'not_shared',
      label,
      message: `This ${subject} isn't shared with ${accessTargetLabel}.`,
    }
  }

  if (metadataSource.status === 'error') {
    return {
      status: 'error',
      label,
      message: `Failed to load ${subject}.`,
    }
  }

  return {
    status: 'not_found',
    label,
    message: `This ${subject} doesn't exist.`,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function findAvailabilityMetadata(
  lookup: ResourceAvailabilityLookup,
  metadataSource: ResourceAvailabilityMetadataLookup,
) {
  if (lookup.kind === 'id') {
    return lookup.id ? metadataSource.getItemById(lookup.id) : undefined
  }

  return lookup.slug ? metadataSource.getItemBySlug(lookup.slug) : undefined
}
