import { useCallback } from 'react'
import { toast } from 'sonner'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { GameMap } from 'convex/gameMaps/types'
import { useSidebarItemMutations } from '~/hooks/useSidebarItemMutations'

interface MapDeleteConfirmDialogProps {
  map: GameMap
  isDeleting: boolean
  onConfirm?: () => void
  onClose: () => void
}

export function MapDeleteConfirmDialog({
  map,
  isDeleting,
  onConfirm,
  onClose,
}: MapDeleteConfirmDialogProps) {
  const { deleteItem } = useSidebarItemMutations()

  const handleConfirm = useCallback(async () => {
    try {
      await deleteItem(map)
      toast.success('Map deleted')
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete map')
    } finally {
      onConfirm?.()
      onClose()
    }
  }, [deleteItem, map, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Map"
      description={`Are you sure you want to delete "${map.name || 'this map'}"? This action cannot be undone.`}
      confirmLabel="Delete Map"
      confirmVariant="destructive"
    />
  )
}
