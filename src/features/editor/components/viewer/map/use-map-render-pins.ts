import type { GameMapWithContent, MapPinWithItem } from 'shared/game-maps/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'

export function useMapRenderPins(map: GameMapWithContent) {
  const { campaignActor } = useEditorMode()
  const { itemsMap: allItemsMap } = useActiveSidebarItems()
  const permOpts = { actor: campaignActor, allItemsMap }
  const canEditMap = effectiveHasAtLeastPermission(map, PERMISSION_LEVEL.EDIT, permOpts)
  const pins = canEditMap ? map.pins : map.pins.filter((pin) => pin.visible === true)

  const isPinGhost = (pin: MapPinWithItem): boolean => {
    if (!pin.item) return true
    return !effectiveHasAtLeastPermission(pin.item, PERMISSION_LEVEL.VIEW, permOpts)
  }

  return { pins, isPinGhost }
}
