import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { useEffect, useState } from 'react'
import type { SortOptions } from 'convex/editors/types'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const defaultSortOptions: SortOptions = {
  order: SORT_ORDERS.DateCreated,
  direction: SORT_DIRECTIONS.Descending,
}

export const useSortOptions = () => {
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const currentEditor = useAuthQuery(
    api.editors.queries.getCurrentEditor,
    campaignData?._id ? { campaignId: campaignData._id } : 'skip',
  )
  const setCurrentEditor = useAppMutation(
    api.editors.mutations.setCurrentEditor,
  )

  const [sortOptions, setSortOptions] = useState(defaultSortOptions)

  useEffect(() => {
    const editor = currentEditor.data
    if (!editor) return

    const nextOptions: SortOptions = {
      order: editor.sortOrder,
      direction: editor.sortDirection,
    }

    setSortOptions((prev) =>
      prev.order === nextOptions.order &&
      prev.direction === nextOptions.direction
        ? prev
        : nextOptions,
    )
  }, [currentEditor.data])

  const setSortOptionsAction = async (options: SortOptions) => {
    setSortOptions(options)
    if (!campaignData?._id) return
    try {
      await setCurrentEditor.mutateAsync({
        campaignId: campaignData._id,
        sortOrder: options.order,
        sortDirection: options.direction,
      })
    } catch (error) {
      handleError(error, 'Failed to save sort options')
    }
  }

  return {
    currentEditor,
    sortOptions,
    setSortOptions: setSortOptionsAction,
  }
}
