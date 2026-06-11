import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useShallow } from 'zustand/shallow'
import { useRef, useState } from 'react'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import type { SidebarItemId } from 'shared/common/ids'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import type { Editor, SortOptions } from 'shared/editor/types'
import type { CampaignActor } from 'shared/campaigns/actor'
import { useCampaignActor } from '~/features/campaigns/hooks/useCampaignActor'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarItemsQueries } from '~/features/sidebar/hooks/useSidebarItems'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
  useSidebarUIStore,
} from '~/features/sidebar/stores/sidebar-ui-store'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { handleError } from '~/shared/utils/logger'
import type { SidebarItemsValue } from '../contexts/sidebar-items-context'
import type { SidebarWorkspaceSelection, SidebarWorkspaceSource } from './sidebar-workspace-source'

export function useLiveSidebarWorkspaceSource(): SidebarWorkspaceSource {
  const { campaignId } = useCampaign()
  const items = useSidebarItemsQueries()
  const campaignActor = useCampaignActor()
  const ui = useCampaignSidebarState(campaignId)
  const uiCommands = useCampaignSidebarActions(campaignId)
  const renamingItemId = useSidebarUIStore((s) => s.renamingId)
  const setRenamingItemId = useSidebarUIStore((s) => s.setRenamingId)
  const { navigateToItem } = useEditorNavigation()
  const selection = useSidebarWorkspaceSelection()
  const selectionCommands = useSidebarWorkspaceSelectionCommands()
  const filteredActiveItems =
    campaignActor?.kind === 'dm'
      ? items.active
      : filterSidebarItemsForActor(items.active, campaignActor)
  const sort = useLiveSidebarSortOptions(campaignId)
  const openParentFolders = (itemId: SidebarItemId) => {
    const ancestors = items.active.getAncestorSidebarItems(itemId)
    for (const ancestor of ancestors) {
      uiCommands.setFolderState(ancestor._id, true)
    }
  }
  return {
    items,
    filteredActiveItems,
    ui,
    uiCommands,
    commands: {
      createSidebarItem: createSidebarItemRequiresFileSystemProvider,
      openItem: navigateToItem,
      openParentFolders,
      setRenamingItemId,
    },
    sort,
    editing: {
      renamingItemId,
    },
    selection,
    selectionCommands,
  }
}

/**
 * Intentional SidebarWorkspaceSource['commands']['createSidebarItem'] stub for live sidebar
 * wiring outside FileSystemProvider.
 *
 * @returns Rejected Promise with Error('createSidebarItem requires FileSystemProvider').
 */
function createSidebarItemRequiresFileSystemProvider(): ReturnType<
  SidebarWorkspaceSource['commands']['createSidebarItem']
> {
  return Promise.reject(new Error('createSidebarItem requires FileSystemProvider'))
}

function useSidebarWorkspaceSelection() {
  return useSidebarUIStore(
    useShallow((s) => ({
      selectedSlug: s.selectedSlug,
      selectedItemIds: s.selectedItemIds,
      focusedItemId: s.focusedItemId,
      activeItemSurface: s.activeItemSurface,
    })),
  )
}

function useSidebarWorkspaceSelectionCommands() {
  return useSidebarUIStore(
    useShallow((s) => ({
      setSelected: s.setSelected,
      setSelectedItemIds: s.setSelectedItemIds,
      selectSingleItem: s.selectSingleItem,
      toggleItemSelection: s.toggleItemSelection,
      selectItemRange: s.selectItemRange,
      setFocusedItem: s.setFocusedItem,
      moveFocus: s.moveFocus,
      clearItemSelection: s.clearItemSelection,
      normalizeContextSelection: s.normalizeContextSelection,
      setActiveItemSurface: s.setActiveItemSurface,
      getSelectionSnapshot: getSidebarWorkspaceSelectionSnapshot,
    })),
  )
}

function getSidebarWorkspaceSelectionSnapshot(): SidebarWorkspaceSelection {
  const state = useSidebarUIStore.getState()
  return {
    selectedSlug: state.selectedSlug,
    selectedItemIds: state.selectedItemIds,
    focusedItemId: state.focusedItemId,
    activeItemSurface: state.activeItemSurface,
  }
}

function useLiveSidebarSortOptions(campaignId: ReturnType<typeof useCampaign>['campaignId']) {
  const queryClient = useQueryClient()
  const currentEditor = useCampaignQuery(api.editors.queries.getCurrentEditor, {})
  const [pendingSortOptions, setPendingSortOptions] = useState<SortOptions | null>(null)
  const [fallbackSortOptions, setFallbackSortOptions] = useState<SortOptions | null>(null)
  const nextMutationId = useRef(0)
  const latestMutationId = useRef(0)
  const rollbackEditor = useRef<Editor | null | undefined>(undefined)
  const rollbackSortOptions = useRef<SortOptions | undefined>(undefined)

  const savedSortOptions = currentEditor.data
    ? editorSortOptions(currentEditor.data)
    : (fallbackSortOptions ?? DEFAULT_SORT_OPTIONS)
  const currentSortOptions = pendingSortOptions ?? savedSortOptions

  const setCurrentEditor = useCampaignMutation(api.editors.mutations.setCurrentEditor, {
    onMutate: async (options) => {
      if (!campaignId) return
      const mutationId = nextMutationId.current + 1
      nextMutationId.current = mutationId
      latestMutationId.current = mutationId

      const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
        campaignId,
      })

      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey })

      const previous = queryClient.getQueryData<Editor | null>(queryOptions.queryKey)
      if (rollbackEditor.current === undefined) {
        rollbackEditor.current = previous
      }
      if (rollbackSortOptions.current === undefined) {
        rollbackSortOptions.current = currentSortOptions
      }
      const nextSortOptions: SortOptions = {
        order: options.sortOrder ?? DEFAULT_SORT_OPTIONS.order,
        direction: options.sortDirection ?? DEFAULT_SORT_OPTIONS.direction,
      }
      setPendingSortOptions(nextSortOptions)

      queryClient.setQueryData(queryOptions.queryKey, (old: Editor | null | undefined) => {
        if (!old) return old
        return {
          ...old,
          sortOrder: nextSortOptions.order,
          sortDirection: nextSortOptions.direction,
        }
      })

      return { queryKey: queryOptions.queryKey, mutationId }
    },
    onError: (err, _vars, context) => {
      if (context?.mutationId === latestMutationId.current) {
        setFallbackSortOptions(rollbackSortOptions.current ?? DEFAULT_SORT_OPTIONS)
        setPendingSortOptions(null)
        queryClient.setQueryData(context.queryKey, rollbackEditor.current)
        rollbackEditor.current = undefined
        rollbackSortOptions.current = undefined
      }
      handleError(err, 'Failed to save sort options')
    },
    onSettled: (_data, error, vars, context) => {
      if (!context || context.mutationId !== latestMutationId.current) return
      if (error) return
      setFallbackSortOptions(sortOptionsFromMutationVars(vars))
      if (!campaignId) {
        setPendingSortOptions(null)
        rollbackEditor.current = undefined
        rollbackSortOptions.current = undefined
        return
      }
      rollbackEditor.current = undefined
      rollbackSortOptions.current = undefined
      const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
        campaignId,
      })
      void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey }).finally(() => {
        if (context.mutationId !== latestMutationId.current) return
        setPendingSortOptions(null)
      })
    },
  })

  return {
    options: currentSortOptions,
    setOptions: (options: SortOptions) => {
      setCurrentEditor.mutate({
        sortOrder: options.order,
        sortDirection: options.direction,
      })
    },
  }
}

function editorSortOptions(editor: Editor): SortOptions {
  return {
    order: editor.sortOrder,
    direction: editor.sortDirection,
  }
}

function sortOptionsFromMutationVars(vars: {
  sortOrder?: SortOptions['order'] | null
  sortDirection?: SortOptions['direction'] | null
}): SortOptions {
  return {
    order: vars.sortOrder ?? DEFAULT_SORT_OPTIONS.order,
    direction: vars.sortDirection ?? DEFAULT_SORT_OPTIONS.direction,
  }
}

function filterSidebarItemsForActor(
  activeItems: SidebarItemsValue,
  campaignActor: CampaignActor | null,
): SidebarItemsValue {
  const permOpts = { actor: campaignActor, allItemsMap: activeItems.itemsMap }
  const filteredData = activeItems.data.filter((item) =>
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )

  return {
    data: filteredData,
    status: activeItems.status,
    error: activeItems.error,
    refetch: activeItems.refetch,
    ...buildSidebarItemMaps(filteredData),
  }
}
