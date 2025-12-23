import { useState, useCallback, useMemo } from 'react'
import type { MenuContext } from '~/components/context-menu/types'
import { useCampaign } from '~/contexts/CampaignContext'
import type { Id } from 'convex/_generated/dataModel'
import { isGameMap } from '~/lib/sidebar-item-utils'
import { MapDialog } from '~/components/forms/map-form/map-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'

export function useMapMenuActions() {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const [deleteMapDialog, setDeleteMapDialog] = useState<GameMap | null>(null)
  const [createMapDialog, setCreateMapDialog] = useState<{
    parentId?: SidebarItemId
  } | null>(null)
  const [editMapDialog, setEditMapDialog] = useState<Id<'gameMaps'> | null>(
    null,
  )

  const actions = {
    createMap: useCallback((ctx: MenuContext) => {
      setCreateMapDialog({ parentId: ctx.item?._id })
    }, []),

    editMap: useCallback((ctx: MenuContext) => {
      if (isGameMap(ctx.item)) {
        setEditMapDialog(ctx.item._id)
      }
    }, []),

    deleteMap: useCallback((ctx: MenuContext) => {
      if (isGameMap(ctx.item)) {
        setDeleteMapDialog(ctx.item)
      }
    }, []),
  }

  const dialogsContent = useMemo(
    () => (
      <>
        {deleteMapDialog && (
          <MapDeleteConfirmDialog
            key={`delete-map-${deleteMapDialog._id}`}
            map={deleteMapDialog}
            isDeleting={true}
            onClose={() => setDeleteMapDialog(null)}
          />
        )}

        {createMapDialog && campaignId && (
          <MapDialog
            key={`create-map-${createMapDialog.parentId || 'root'}`}
            isOpen={true}
            onClose={() => setCreateMapDialog(null)}
            campaignId={campaignId}
            parentId={createMapDialog.parentId}
          />
        )}

        {editMapDialog && campaignId && (
          <MapDialog
            key={`edit-map-${editMapDialog}`}
            mapId={editMapDialog}
            isOpen={true}
            onClose={() => setEditMapDialog(null)}
            campaignId={campaignId}
          />
        )}
      </>
    ),
    [deleteMapDialog, createMapDialog, editMapDialog, campaignId],
  )

  const Dialogs = useCallback(() => dialogsContent, [dialogsContent])

  return {
    actions,
    Dialogs,
  }
}
