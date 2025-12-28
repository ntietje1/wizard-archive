import { useCallback } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { ConfirmationDialog } from '../confirmation-dialog'
import type { GameMap } from 'convex/gameMaps/types'

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
  const deleteMapMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.deleteMap),
  })

  const handleConfirm = useCallback(async () => {
    await deleteMapMutation
      .mutateAsync({ mapId: map._id })
      .then(() => {
        toast.success('Map deleted')
      })
      .catch((error: Error) => {
        console.error(error)
        toast.error('Failed to delete map')
      })
      .finally(() => {
        onConfirm?.()
        onClose()
      })
  }, [deleteMapMutation, map._id, onConfirm, onClose])

  return (
    <ConfirmationDialog
      isOpen={isDeleting}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Delete Map"
      description={`Are you sure you want to delete "${map.name || 'this map'}"? This action cannot be undone.`}
      confirmLabel="Delete Map"
      confirmVariant="destructive"
      isLoading={deleteMapMutation.isPending}
    />
  )
}
