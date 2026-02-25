import { useCallback, useRef, useState } from 'react'
import { useCampaign } from './useCampaign'
import { useFileDropHandler } from './useFileDropHandler'
import type { Id } from 'convex/_generated/dataModel'
import type { DropResult } from '~/lib/folder-reader'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { processDataTransferItems } from '~/lib/folder-reader'

export function useFileDragDrop(parentId?: Id<'folders'>) {
  const { campaignId } = useCampaign()
  const { handleDrop: handleDropFiles } = useFileDropHandler()
  const setFileDragHoveredId = useSidebarUIStore((s) => s.setFileDragHoveredId)
  const setGlobalIsDraggingFiles = useSidebarUIStore(
    (s) => s.setIsDraggingFiles,
  )

  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const dragDepthRef = useRef(0)

  const isFileDrag = useCallback((e: React.DragEvent): boolean => {
    const types = e.dataTransfer.types
    for (const type of types) {
      if (type === 'Files') return true
    }
    return false
  }, [])

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current++
      setIsDraggingFiles(true)
      setGlobalIsDraggingFiles(true)
      if (parentId) {
        setFileDragHoveredId(parentId)
      }
    },
    [isFileDrag, parentId, setFileDragHoveredId, setGlobalIsDraggingFiles],
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
        setGlobalIsDraggingFiles(false)
        if (parentId) {
          setFileDragHoveredId(null)
        }
      }
    },
    [isFileDrag, parentId, setFileDragHoveredId, setGlobalIsDraggingFiles],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!isFileDrag(e)) return

      e.preventDefault()
      e.stopPropagation()
      dragDepthRef.current = 0
      setIsDraggingFiles(false)
      setGlobalIsDraggingFiles(false)
      setFileDragHoveredId(null)

      if (!campaignId) return

      const dropResult: DropResult = await processDataTransferItems(
        e.dataTransfer.items,
      )
      if (dropResult.files.length > 0 || dropResult.rootFolders.length > 0) {
        handleDropFiles(dropResult, { campaignId, parentId })
      }
    },
    [
      isFileDrag,
      campaignId,
      handleDropFiles,
      parentId,
      setFileDragHoveredId,
      setGlobalIsDraggingFiles,
    ],
  )

  return {
    isDraggingFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
