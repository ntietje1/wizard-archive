import { createWorkspaceResource } from '../runtime'
import { FileDialog } from '../../files/forms/dialog'
import type { FileFormSource } from '../../files/forms/source'
import { useFileUploadControl } from '../../files/forms/use-file-upload-control'
import type { FileSession } from '../../files/session-contract'
import type { FileItem } from '../../files/item-contract'
import type { ResourceCatalog } from '../../filesystem/catalog'
import type { FileSystemItemFormOperations } from '../../filesystem/item-operation-contracts'
import { createItemContentLoadState, narrowItemContentLoadState } from '../../filesystem/load-state'
import type { FileSystemLoadState } from '../../filesystem/load-state'
import { MapDialog } from '../../game-maps/forms/dialog'
import type { MapFormSource } from '../../game-maps/forms/source'
import { validateFileForUpload } from '../../../../../shared/storage/validation'
import { RESOURCE_TYPES } from '../items-persistence-contract'
import type { AnyItem } from '../items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MapItem } from '../../game-maps/item-contract'
import type { MapSession } from '../../game-maps/session-contract'
import type { WorkspaceNavigation } from '../runtime'

type RuntimeItemEditDialogFilesystemInput = {
  catalog: Pick<ResourceCatalog, 'getKnownItemById'>
  load: Pick<FileSystemLoadState, 'activeStatus'>
  operations: FileSystemItemFormOperations
}

type RuntimeMapEditDialogInput = {
  filesystem: RuntimeItemEditDialogFilesystemInput
  sessions: {
    map: Pick<MapSession, 'updateMapImage'>
  }
}

type RuntimeFileEditDialogInput = {
  navigation: {
    openItem: WorkspaceNavigation['openItem']
  }
  filesystem: RuntimeItemEditDialogFilesystemInput
  sessions: {
    file: Pick<FileSession, 'maxUploadBytes' | 'replaceFile'>
  }
}

export function RuntimeMapEditDialog({
  mapId,
  onClose,
  runtime,
}: {
  mapId: SidebarItemId
  onClose: () => void
  runtime: RuntimeMapEditDialogInput
}) {
  const { catalog, load, operations } = runtime.filesystem
  const { map } = runtime.sessions
  const mapEditState = narrowItemContentLoadState(
    createItemContentLoadState({
      item: catalog.getKnownItemById(mapId),
      itemId: mapId,
      isPending: load.activeStatus === 'pending',
    }),
    isGameMapItem,
  )
  const mapImageUpload = useFileUploadControl({
    existingContentType: mapEditState.item ? 'image/*' : null,
    existingName: mapEditState.item?.name ?? null,
    existingPreviewUrl: mapEditState.item?.imageUrl ?? null,
    existingSize: null,
    isOpen: true,
    fileTypeValidator: validateMapImageFile,
  })
  const mapFormSource: MapFormSource = {
    updateItemMetadata: operations.updateItemMetadata,
    updateMapImage: map.updateMapImage,
    validateItemName: operations.validateItemName,
  }

  return (
    <MapDialog
      mapState={mapEditState}
      mapId={mapId}
      isOpen={true}
      onClose={onClose}
      onSuccess={onClose}
      source={mapFormSource}
      upload={mapImageUpload}
    />
  )
}

export function RuntimeFileEditDialog({
  fileId,
  onClose,
  runtime,
}: {
  fileId: SidebarItemId
  onClose: () => void
  runtime: RuntimeFileEditDialogInput
}) {
  const { catalog, load, operations } = runtime.filesystem
  const { file } = runtime.sessions
  const fileEditState = narrowItemContentLoadState(
    createItemContentLoadState({
      item: catalog.getKnownItemById(fileId),
      itemId: fileId,
      isPending: load.activeStatus === 'pending',
    }),
    isFileItem,
  )
  const fileUpload = useFileUploadControl({
    existingContentType: fileEditState.item?.contentType ?? null,
    existingName: fileEditState.item?.name ?? null,
    existingPreviewUrl: fileEditState.item?.downloadUrl ?? null,
    existingSize: null,
    isOpen: true,
    fileTypeValidator: validateFileForUpload,
    maxFileSize: file.maxUploadBytes,
  })
  const fileFormSource: FileFormSource = {
    createItem: operations.createItem,
    openItem: async (itemId) => {
      await runtime.navigation.openItem(createWorkspaceResource(itemId))
    },
    replaceFile: file.replaceFile,
    updateItemMetadata: operations.updateItemMetadata,
    validateItemName: operations.validateItemName,
  }

  return (
    <FileDialog
      fileState={fileEditState}
      fileId={fileId}
      isOpen={true}
      onClose={onClose}
      onSuccess={onClose}
      source={fileFormSource}
      upload={fileUpload}
    />
  )
}

function validateMapImageFile(file: File) {
  const fileResult = validateFileForUpload(file)
  if (!fileResult.valid) return fileResult

  if (!file.type.startsWith('image/')) {
    return { valid: false as const, error: 'Only image files are allowed' }
  }
  return fileResult
}

function isFileItem(item: AnyItem): item is FileItem {
  return item.type === RESOURCE_TYPES.files
}

function isGameMapItem(item: AnyItem): item is MapItem {
  return item.type === RESOURCE_TYPES.gameMaps
}
