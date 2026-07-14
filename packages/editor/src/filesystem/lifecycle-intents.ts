import type { ResourceId } from '../resources/domain-id'
import type { FileSystemLifecycleIntent } from './domain/lifecycle'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'

type FileSystemLifecycleSelectionState = {
  selectedItemIds: ReadonlyArray<ResourceId>
  clearItemSelection: () => void
}

type FileSystemLifecycleIntentAdapters = {
  setFolderState: (workspaceId: string, folderId: ResourceId, isOpen: boolean) => void
  setSelectedItemIds: (itemIds: ReadonlyArray<ResourceId>, focusedItemId?: ResourceId) => void
  getSelectionState: () => FileSystemLifecycleSelectionState
  getCurrentResourceId: () => ResourceId | null
  openResource: (resource: AnyItem, options?: { replace?: boolean }) => Promise<void>
  clearWorkspaceContent: () => Promise<void>
}

export async function applyFileSystemLifecycleIntents({
  intents,
  previousResourceId,
  readModel,
  adapters,
}: {
  intents: Array<FileSystemLifecycleIntent>
  previousResourceId: ResourceId | null
  readModel: Pick<WorkspaceResourceReadModel<AnyItem>, 'getItem'>
  adapters: FileSystemLifecycleIntentAdapters
}) {
  for (const intent of intents) {
    await applyFileSystemLifecycleIntent({ intent, previousResourceId, readModel, adapters })
  }
}

async function applyFileSystemLifecycleIntent({
  intent,
  previousResourceId,
  readModel,
  adapters,
}: {
  intent: FileSystemLifecycleIntent
  previousResourceId: ResourceId | null
  readModel: Pick<WorkspaceResourceReadModel<AnyItem>, 'getItem'>
  adapters: FileSystemLifecycleIntentAdapters
}) {
  switch (intent.type) {
    case 'openFolder':
      adapters.setFolderState(intent.workspaceId, intent.folderId, true)
      return
    case 'selectItem':
      adapters.setSelectedItemIds([intent.itemId], intent.itemId)
      return
    case 'selectItems':
      adapters.setSelectedItemIds(intent.itemIds, intent.focusedItemId)
      return
    case 'openResource': {
      const resource = readModel.getItem(intent.itemId)
      if (!resource) {
        throw new Error(`Cannot open missing filesystem resource ${intent.itemId}`)
      }
      await adapters.openResource(resource, { replace: intent.replace })
      return
    }
    case 'clearEditor':
      await adapters.clearWorkspaceContent()
      return
    case 'restorePreviousLocation': {
      if (adapters.getCurrentResourceId() !== intent.guardedByItemId) return
      const state = adapters.getSelectionState()
      state.clearItemSelection()
      const previousResource = previousResourceId
        ? readModel.getItem(previousResourceId)
        : undefined
      if (previousResource) {
        await adapters.openResource(previousResource, { replace: true })
      } else {
        await adapters.clearWorkspaceContent()
      }
      return
    }
    default:
      return assertNever(intent)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported filesystem lifecycle intent: ${JSON.stringify(value)}`)
}
