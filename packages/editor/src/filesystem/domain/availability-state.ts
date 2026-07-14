import type { ResourceId } from '../../resources/domain-id'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { FileSystemLoadState } from '../load-state'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
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

interface ResourceAvailabilityMetadataLookup {
  getItemById: (itemId: ResourceId) => AnyItem | null | undefined
}

interface ResourceAvailabilityMetadataSource {
  directMessage: ResourceAvailabilityMetadataLookup
  player: ResourceAvailabilityMetadataLookup
  status: 'pending' | 'error' | 'success'
}

type ResourceAvailabilityCatalog = {
  getKnownItemById: (itemId: ResourceId) => AnyItem | null | undefined
  getVisibleItemById: (itemId: ResourceId) => AnyItem | null | undefined
}

export function createResourceAvailabilityMetadataSource(input: {
  catalog: ResourceAvailabilityCatalog
  load: Pick<FileSystemLoadState, 'activeStatus'>
}): ResourceAvailabilityMetadataSource {
  return {
    directMessage: {
      getItemById: input.catalog.getKnownItemById,
    },
    player: {
      getItemById: input.catalog.getVisibleItemById,
    },
    status: input.load.activeStatus,
  }
}

export function resolveResourceAvailabilityState({
  resourceId,
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
  resourceId: ResourceId | null | undefined
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
  const metadata = resourceId ? metadataLookup.getItemById(resourceId) : undefined
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
