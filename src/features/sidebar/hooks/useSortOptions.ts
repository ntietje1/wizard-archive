import { convexQuery } from '@convex-dev/react-query'
import { createContext, createElement, useContext, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import type { Editor, SortOptions } from 'shared/editor/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

type CurrentEditorQuery = ReturnType<
  typeof useCampaignQuery<typeof api.editors.queries.getCurrentEditor>
>

interface SidebarSortOptionsContextValue {
  currentEditor: CurrentEditorQuery
  sortOptions: SortOptions
  setSortOptions: (options: SortOptions) => void
}

const SidebarSortOptionsContext = createContext<SidebarSortOptionsContextValue | null>(null)

export function SidebarSortOptionsProvider({ children }: { children: React.ReactNode }) {
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()
  const currentEditor = useCampaignQuery(api.editors.queries.getCurrentEditor, {})
  const [pendingSortOptions, setPendingSortOptions] = useState<SortOptions | null>(null)
  const nextMutationId = useRef(0)
  const latestMutationId = useRef(0)

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

      return { previous, queryKey: queryOptions.queryKey, mutationId }
    },
    onError: (err, _vars, context) => {
      if (context?.mutationId === latestMutationId.current) {
        setPendingSortOptions(null)
        queryClient.setQueryData(context.queryKey, context.previous)
      }
      handleError(err, 'Failed to save sort options')
    },
    onSettled: (_data, _error, _vars, context) => {
      if (!context || context.mutationId !== latestMutationId.current) return
      if (!campaignId) {
        setPendingSortOptions(null)
        return
      }
      const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
        campaignId,
      })
      void queryClient
        .invalidateQueries({ queryKey: queryOptions.queryKey })
        .finally(() => setPendingSortOptions(null))
    },
  })

  const savedSortOptions = currentEditor.data
    ? {
        order: currentEditor.data.sortOrder,
        direction: currentEditor.data.sortDirection,
      }
    : DEFAULT_SORT_OPTIONS

  const setSortOptions = (options: SortOptions) => {
    setCurrentEditor.mutate({
      sortOrder: options.order,
      sortDirection: options.direction,
    })
  }

  const value = {
    currentEditor,
    sortOptions: pendingSortOptions ?? savedSortOptions,
    setSortOptions,
  }

  return createElement(SidebarSortOptionsContext.Provider, { value }, children)
}

export const useSortOptions = () => {
  const context = useContext(SidebarSortOptionsContext)
  if (!context) {
    throw new Error('useSortOptions must be used within a SidebarSortOptionsProvider')
  }
  return context
}
