import { useNavigate } from '@tanstack/react-router'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { handleError } from '~/shared/utils/logger'
import { TrashPopoverSurface } from './trash-popover-surface'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useTrashSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useFileSystem } from '~/features/filesystem/useFileSystem'
import {
  canDeleteSidebarItemsForever,
  canRestoreSidebarItems,
} from '~/features/filesystem/filesystem-capabilities'
import { useItemSurfaceRegistration } from '~/features/sidebar/hooks/useItemSurfaceRegistration'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { EDITOR_ROUTE } from '~/features/sidebar/hooks/useEditorLinkProps'

interface TrashPopoverContentProps {
  onClose: () => void
}

function getDeletionTimeLabel(item: AnySidebarItem) {
  const dt = item.deletionTime
  if (!dt) return ''
  return new Date(dt).toLocaleDateString()
}

export function TrashPopoverContent({ onClose }: TrashPopoverContentProps) {
  const { isDm, dmUsername, campaignSlug, campaign } = useCampaign()
  const memberRole = campaign.data?.myMembership?.role
  const { setLastSelectedItem } = useLastEditorItem()
  const navigate = useNavigate()

  const { parentItemsMap } = useTrashSidebarItems()
  const rootTrashedItems = parentItemsMap.get(null) ?? []
  const visibleItemIds = rootTrashedItems.map((item) => item._id)
  const { activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps } =
    useItemSurfaceRegistration({
      surface: 'trash',
      parentId: null,
      visibleItemIds,
    })

  const filesystem = useFileSystem()

  const handleRestore = async (item: AnySidebarItem) => {
    try {
      await filesystem.restoreItems([item._id], null)
    } catch (error) {
      handleError(error, 'Failed to restore item')
    }
  }

  const handlePermanentDelete = (item: AnySidebarItem) => {
    try {
      filesystem.confirmDeleteForever([item._id])
    } catch (error) {
      handleError(error, 'Failed to permanently delete item')
    }
  }

  const handleItemClick = (item: AnySidebarItem) => {
    setLastSelectedItem(item.slug)
  }

  return (
    <div
      className="group/sidebar-surface"
      onFocusCapture={activateSurface}
      onPointerDownCapture={handleSurfacePointerDown}
      onContextMenuCapture={activateSurface}
      {...itemSurfaceHotkeyProps}
    >
      <TrashPopoverSurface
        items={rootTrashedItems.map((item) => ({
          id: item._id,
          icon: getSidebarItemIcon(item),
          name: item.name,
          deletedLabel: getDeletionTimeLabel(item),
          canRestore: canRestoreSidebarItems(memberRole, [item]),
          canDeleteForever: canDeleteSidebarItemsForever(memberRole, [item]),
        }))}
        canEmptyTrash={isDm}
        onOpenFullPage={() => {
          onClose()
          void navigate({
            to: EDITOR_ROUTE,
            params: { dmUsername, campaignSlug },
            search: { trash: true },
          })
        }}
        onItemClick={(surfaceItem) => {
          const item = rootTrashedItems.find((candidate) => candidate._id === surfaceItem.id)
          if (!item) return
          handleItemClick(item)
          void navigate({
            to: EDITOR_ROUTE,
            params: { dmUsername, campaignSlug },
            search: { item: item.slug },
          })
        }}
        onRestore={(surfaceItem) => {
          const item = rootTrashedItems.find((candidate) => candidate._id === surfaceItem.id)
          if (item) void handleRestore(item)
        }}
        onDeleteForever={(surfaceItem) => {
          const item = rootTrashedItems.find((candidate) => candidate._id === surfaceItem.id)
          if (item) handlePermanentDelete(item)
        }}
        onEmptyTrash={() => filesystem.confirmEmptyTrash()}
      />
    </div>
  )
}
