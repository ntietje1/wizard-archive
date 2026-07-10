import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceTransactionReceipt } from './transaction-contract'
import type { FileSystemLifecycleIntent } from './domain/lifecycle'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'
import { planFileSystemReceiptEffects } from './receipt-effect-planner'

export type FileSystemReceiptEffectError = {
  effect: 'clearEditor' | 'openResource'
  receipt: ResourceTransactionReceipt
  currentResourceId: SidebarItemId | null
  navigationResourceId?: SidebarItemId
}

async function applyReceiptIntent({
  intent,
  receipt,
  currentResourceId,
  readModel,
  setSelectedItemIds,
  clearWorkspaceContent,
  openResource,
  reportEffectError,
}: {
  intent: FileSystemLifecycleIntent
  receipt: ResourceTransactionReceipt
  currentResourceId: SidebarItemId | null
  readModel: WorkspaceResourceReadModel<AnyItem>
  setSelectedItemIds: (itemIds: Array<SidebarItemId>) => void
  clearWorkspaceContent: () => Promise<void>
  openResource: (resource: AnyItem, options?: { replace?: boolean }) => Promise<void>
  reportEffectError: (error: unknown, context: FileSystemReceiptEffectError) => void
}) {
  switch (intent.type) {
    case 'selectItems':
      setSelectedItemIds(intent.itemIds)
      return
    case 'clearEditor':
      try {
        await clearWorkspaceContent()
      } catch (error) {
        reportEffectError(error, { effect: 'clearEditor', receipt, currentResourceId })
      }
      return
    case 'openResource': {
      const resource = readModel.getItem(intent.itemId)
      if (!resource) return
      try {
        await openResource(resource, { replace: intent.replace })
      } catch (error) {
        reportEffectError(error, {
          effect: 'openResource',
          receipt,
          currentResourceId,
          navigationResourceId: intent.itemId,
        })
      }
      return
    }
    case 'openFolder':
    case 'selectItem':
    case 'restorePreviousLocation':
      return
  }
}

export async function applyFileSystemReceiptEffects({
  receipt,
  readModel,
  currentResourceId,
  getSelectedItemIds,
  setSelectedItemIds,
  clearWorkspaceContent,
  openResource,
  reportEffectError,
}: {
  receipt: ResourceTransactionReceipt
  readModel: WorkspaceResourceReadModel<AnyItem>
  currentResourceId: SidebarItemId | null
  getSelectedItemIds: () => ReadonlyArray<SidebarItemId>
  setSelectedItemIds: (itemIds: ReadonlyArray<SidebarItemId>) => void
  clearWorkspaceContent: () => Promise<void>
  openResource: (resource: AnyItem, options?: { replace?: boolean }) => Promise<void>
  reportEffectError: (error: unknown, context: FileSystemReceiptEffectError) => void
}) {
  const intents = planFileSystemReceiptEffects({
    receipt,
    readModel,
    currentResourceId,
    selectedItemIds: getSelectedItemIds(),
  })

  await intents.reduce<Promise<void>>(
    (chain, intent) =>
      chain.then(() =>
        applyReceiptIntent({
          intent,
          receipt,
          currentResourceId,
          readModel,
          setSelectedItemIds,
          clearWorkspaceContent,
          openResource,
          reportEffectError,
        }),
      ),
    Promise.resolve(),
  )
}
