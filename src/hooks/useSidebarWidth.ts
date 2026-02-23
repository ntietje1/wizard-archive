import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCampaign } from '~/hooks/useCampaign'

const DEFAULT_SIDEBAR_WIDTH = 280
const DEFAULT_SIDEBAR_EXPANDED = true

export const useEditorSettings = () => {
  const { campaign } = useCampaign()
  const campaignData = campaign.data

  const editorQuery = useQuery({
    ...convexQuery(
      api.editors.queries.getCurrentEditor,
      campaignData?._id ? { campaignId: campaignData._id } : 'skip',
    ),
    staleTime: 5000,
  })

  const setCurrentEditor = useMutation({
    mutationFn: useConvexMutation(api.editors.mutations.setCurrentEditor),
  })

  // Local state for immediate UI updates
  const serverWidth = editorQuery.data?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
  const serverExpanded =
    editorQuery.data?.isSidebarExpanded ?? DEFAULT_SIDEBAR_EXPANDED

  const [localWidth, setLocalWidth] = useState(serverWidth)
  const [localExpanded, setLocalExpanded] = useState(serverExpanded)
  const hasInitialized = useRef(false)

  // Sync server values to local state on initial load only
  useEffect(() => {
    if (editorQuery.isFetched && !hasInitialized.current) {
      setLocalWidth(serverWidth)
      setLocalExpanded(serverExpanded)
      hasInitialized.current = true
    }
  }, [editorQuery.isFetched, serverWidth, serverExpanded])

  // Debounce ref to avoid excessive mutations during drag
  const widthDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSidebarWidth = useCallback(
    (width: number) => {
      setLocalWidth(width)

      if (!campaignData?._id) return

      if (widthDebounceRef.current) {
        clearTimeout(widthDebounceRef.current)
      }

      widthDebounceRef.current = setTimeout(() => {
        setCurrentEditor.mutate({
          campaignId: campaignData._id,
          sidebarWidth: width,
        })
      }, 300)
    },
    [campaignData?._id, setCurrentEditor],
  )

  const setIsSidebarExpanded = useCallback(
    (expanded: boolean) => {
      setLocalExpanded(expanded)

      if (!campaignData?._id) return

      // No debounce for expanded state - it's a toggle, not continuous
      setCurrentEditor.mutate({
        campaignId: campaignData._id,
        isSidebarExpanded: expanded,
      })
    },
    [campaignData?._id, setCurrentEditor],
  )

  // Use isSuccess to ensure we have actual data (not just that a fetch was attempted)
  // Also require campaign to exist, otherwise query is skipped
  const isLoaded = !!campaignData?._id && editorQuery.isSuccess

  return {
    sidebarWidth: localWidth,
    setSidebarWidth,
    isSidebarExpanded: localExpanded,
    setIsSidebarExpanded,
    isLoaded,
  }
}
