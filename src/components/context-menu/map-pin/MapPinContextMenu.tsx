import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import type { Id } from 'convex/_generated/dataModel'
import { useOpenParentFolders } from '~/hooks/useOpenParentFolders'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCampaign } from '~/contexts/CampaignContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/components/shadcn/ui/dropdown-menu'
import { Trash2, Move, Eye, FileText } from 'lucide-react'
import { createPortal } from 'react-dom'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'

interface PinPosition {
  x: number
  y: number
}

interface MapPinContextMenuProps {
  pinId: Id<'mapPins'>
  mapId: Id<'gameMaps'>
  position: PinPosition
  onClose: () => void
}

export function MapPinContextMenu({
  pinId,
  mapId,
  position,
  onClose,
}: MapPinContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(true)
  const { campaignWithMembership } = useCampaign()
  const memberRole = campaignWithMembership.data?.member.role
  const isDm = memberRole && memberRole === CAMPAIGN_MEMBER_ROLE.DM

  const pinsQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapPins, { mapId }),
  )
  const removePinMutation = useMutation({
    mutationFn: useConvexMutation(api.gameMaps.mutations.removeItemPin),
  })
  // const updatePinMutation = useMutation({
  //   mutationFn: useConvexMutation(api.gameMaps.mutations.updateItemPin),
  // })

  const pin = pinsQuery.data?.find((p) => p._id === pinId)
  const { openParentFolders } = useOpenParentFolders()
  const { navigateToItem } = useEditorNavigation()

  const handleRemovePin = useCallback(async () => {
    if (!pin) return
    try {
      await removePinMutation.mutateAsync({
        mapPinId: pinId,
      })
      toast.success('Pin removed')
      setIsOpen(false)
      onClose()
    } catch (error) {
      console.error('Failed to remove pin:', error)
      toast.error('Failed to remove pin')
    }
  }, [pin, pinId, removePinMutation, onClose])

  const handleMovePin = useCallback(() => {
    if (!pin) return
    // For now, just show a toast. In the future, this could enable drag mode
    toast.info('Move pin not yet implemented')
    setIsOpen(false)
    onClose()
  }, [pin, onClose])

  const handleFindInSidebar = useCallback(async () => {
    if (!pin) return
    try {
      await openParentFolders(pin.item._id)
      setIsOpen(false)
      onClose()
    } catch (error) {
      console.error('Failed to find item in sidebar:', error)
      toast.error('Failed to find item in sidebar')
    }
  }, [pin, openParentFolders, onClose])

  const handleOpenItem = useCallback(() => {
    if (!pin) return
    navigateToItem(pin.item)
    setIsOpen(false)
    onClose()
  }, [pin, navigateToItem, onClose])

  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const [adjustedPosition, setAdjustedPosition] = useState(position)

  useEffect(() => {
    if (!menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const newX =
      position.x + rect.width > window.innerWidth
        ? window.innerWidth - rect.width - 8
        : position.x
    const newY =
      position.y + rect.height > window.innerHeight
        ? window.innerHeight - rect.height - 8
        : position.y

    setAdjustedPosition({ x: newX, y: newY })
  }, [position])

  if (!pin) return null

  const menuContent = (
    <div
      ref={menuRef}
      data-context-menu
      style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) {
            onClose()
          }
        }}
        modal={false}
      >
        <DropdownMenuContent
          data-context-menu
          className="w-48 z-[9999]"
          style={{
            position: 'fixed',
            top: adjustedPosition.y,
            left: adjustedPosition.x,
            pointerEvents: 'auto',
          }}
          sideOffset={0}
          alignOffset={0}
          align="end"
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              handleOpenItem()
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            <span>Open Item</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              handleFindInSidebar()
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            <span>Find in Sidebar</span>
          </DropdownMenuItem>
          {isDm && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleMovePin()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                <Move className="h-4 w-4 mr-2" />
                <span>Move Pin</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleRemovePin()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                <span>Remove Pin</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return createPortal(menuContent, document.body)
}

