import { useCallback, useRef, useState } from 'react'
import { useCampaign } from './useCampaign'
import { useFileDropHandler } from './useFileDropHandler'
import type { SidebarItemId } from 'convex/sidebarItems/types'

/**
 * Hook to handle native file drag-and-drop events.
 * Distinguishes between file drags (from OS) and internal dnd-kit drags.
 */
export function useFileDragDrop(parentId?: SidebarItemId) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { handleFileDrop } = useFileDropHandler()

  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const dragDepthRef = useRef(0)

  const isFileDrag = useCallback((e: React.DragEvent): boolean => {
    const types = Array.from(e.dataTransfer.types)
    return types.includes('Files') && !types.includes('application/x-dndkit')
  }, [])

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return

      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current++
      setIsDraggingFiles(true)
    },
    [isFileDrag],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
    },
    [isFileDrag],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return

      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current--

      if (dragDepthRef.current === 0) {
        setIsDraggingFiles(false)
      }
    },
    [isFileDrag],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return

      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current = 0
      setIsDraggingFiles(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0 || !campaignId) return

      handleFileDrop(files, {
        campaignId,
        parentId,
      })
    },
    [isFileDrag, campaignId, handleFileDrop, parentId],
  )

  return {
    isDraggingFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
