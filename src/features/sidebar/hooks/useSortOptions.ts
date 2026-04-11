import { api } from 'convex/_generated/api'
import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import { useEffect, useState } from 'react'
import type { SortOptions } from 'convex/editors/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

const defaultSortOptions: SortOptions = {
  order: SORT_ORDERS.DateCreated,
  direction: SORT_DIRECTIONS.Descending,
}

export const useSortOptions = () => {
  const currentEditor = useCampaignQuery(api.editors.queries.getCurrentEditor, {})
  const setCurrentEditor = useCampaignMutation(api.editors.mutations.setCurrentEditor)

  const [sortOptions, setSortOptions] = useState(defaultSortOptions)

  useEffect(() => {
    const editor = currentEditor.data
    if (!editor) return

    const nextOptions: SortOptions = {
      order: editor.sortOrder,
      direction: editor.sortDirection,
    }

    setSortOptions((prev) =>
      prev.order === nextOptions.order && prev.direction === nextOptions.direction
        ? prev
        : nextOptions,
    )
  }, [currentEditor.data])

  const setSortOptionsAction = async (options: SortOptions) => {
    setSortOptions(options)
    try {
      await setCurrentEditor.mutateAsync({
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
