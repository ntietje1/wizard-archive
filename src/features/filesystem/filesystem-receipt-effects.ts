import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import type { FileSystemLifecycleIntent } from 'shared/sidebar-items/filesystem/lifecycle'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { FileSystemReadModel } from 'shared/sidebar-items/filesystem/read-model'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import { planFileSystemReceiptEffects } from './filesystem-receipt-effect-planner'
import { logger } from '~/shared/utils/logger'

async function applyReceiptIntent({
  intent,
  receipt,
  currentSlug,
  setSelectedItemIds,
  clearEditorContent,
  navigateToItem,
}: {
  intent: FileSystemLifecycleIntent
  receipt: FileSystemTransactionReceipt
  currentSlug: string | null
  setSelectedItemIds: (itemIds: Array<Id<'sidebarItems'>>) => void
  clearEditorContent: () => Promise<void>
  navigateToItem: (slug: SidebarItemSlug, replace?: boolean) => Promise<void>
}) {
  switch (intent.type) {
    case 'selectItems':
      setSelectedItemIds(intent.itemIds)
      return
    case 'clearEditor':
      try {
        await clearEditorContent()
      } catch (error) {
        logger.error('Failed to clear editor content after filesystem receipt', {
          transactionId: receipt.transactionId,
          direction: receipt.direction,
          currentSlug,
          error,
        })
      }
      return
    case 'navigateToItem':
      try {
        await navigateToItem(intent.slug, intent.replace)
      } catch (error) {
        logger.error('Failed to navigate after filesystem receipt', {
          transactionId: receipt.transactionId,
          direction: receipt.direction,
          currentSlug,
          navigationSlug: intent.slug,
          parsedNavigationSlug: intent.slug,
          error,
        })
      }
      return
    case 'openFolder':
    case 'selectItem':
    case 'restorePreviousLocation':
      return
  }
}

export async function applyFileSystemReceiptEffects({
  receipt,
  readModel,
  currentSlug,
  getSelectedItemIds,
  setSelectedItemIds,
  clearEditorContent,
  navigateToItem,
}: {
  receipt: FileSystemTransactionReceipt
  readModel: FileSystemReadModel<AnySidebarItem>
  currentSlug: string | null
  getSelectedItemIds: () => Array<Id<'sidebarItems'>>
  setSelectedItemIds: (itemIds: Array<Id<'sidebarItems'>>) => void
  clearEditorContent: () => Promise<void>
  navigateToItem: (slug: SidebarItemSlug, replace?: boolean) => Promise<void>
}) {
  const intents = planFileSystemReceiptEffects({
    receipt,
    readModel,
    currentSlug,
    selectedItemIds: getSelectedItemIds(),
  })

  await intents.reduce<Promise<void>>(
    (chain, intent) =>
      chain.then(() =>
        applyReceiptIntent({
          intent,
          receipt,
          currentSlug,
          setSelectedItemIds,
          clearEditorContent,
          navigateToItem,
        }),
      ),
    Promise.resolve(),
  )
}
