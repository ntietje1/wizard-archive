import { api } from 'convex/_generated/api'
import {
  readWizardEditorResourceTransactionReceipt,
  useWizardEditorResourceCommandRuntime,
} from '@wizard-archive/editor/adapter'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLiveSidebarItemsCache } from '~/editor-adapters/live/filesystem/sidebar-items-cache'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import type { LiveFileSystemReadModel } from './read-model'

type LiveFileSystemRuntime = ReturnType<typeof useWizardEditorResourceCommandRuntime>

export type LiveFileSystemHost = LiveFileSystemRuntime['filesystem']
export type LiveSidebarItemsShareOperations = LiveFileSystemRuntime['sharing']['sidebarItems']
type LiveResourceId = WizardEditorItem['id']

type LiveFileSystemNavigation = {
  getCurrentResourceId: () => LiveResourceId | null
  clearWorkspaceContent: () => Promise<void>
  openResource: (
    resource: WizardEditorItem,
    options?: { heading?: string; replace?: boolean },
  ) => Promise<void>
}

type LiveFileSystemTrashState = {
  items: LiveFileSystemReadModel['visibleTrashItems']
  status: LiveFileSystemReadModel['trashStatus']
}

export function useLiveFileSystemRuntime(
  workspaceId: string,
  navigation: LiveFileSystemNavigation,
  filesystemReadModel: LiveFileSystemReadModel,
): LiveFileSystemRuntime {
  const { campaign } = useCampaign()
  const cache = useLiveSidebarItemsCache()
  const executeMutation = useCampaignMutation(
    api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
  )
  const undoMutation = useCampaignMutation(
    api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
  )
  const redoMutation = useCampaignMutation(
    api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
  )
  const trashDialogState: LiveFileSystemTrashState = {
    items: filesystemReadModel.visibleTrashItems,
    status: filesystemReadModel.trashStatus,
  }
  return useWizardEditorResourceCommandRuntime({
    workspaceId,
    currentUserId: campaign.data?.myMembership?.userId ?? null,
    cache,
    navigation,
    trashState: trashDialogState,
    executeMutation: async (args) =>
      readLiveResourceTransactionReceipt(
        await executeMutation.mutateAsync(args),
        'execute command',
      ),
    undoMutation: async (transactionId) =>
      readLiveResourceTransactionReceipt(
        await undoMutation.mutateAsync({ transactionId }),
        'undo transaction',
      ),
    redoMutation: async (transactionId) =>
      readLiveResourceTransactionReceipt(
        await redoMutation.mutateAsync({ transactionId }),
        'redo transaction',
      ),
  })
}

function readLiveResourceTransactionReceipt(
  result: unknown,
  operation: string,
): NonNullable<ReturnType<typeof readWizardEditorResourceTransactionReceipt>> {
  const receipt = readWizardEditorResourceTransactionReceipt(result)
  if (receipt) return receipt
  throw new Error(`Live filesystem ${operation} did not return a transaction receipt`)
}
