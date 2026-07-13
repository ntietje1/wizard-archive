import type { MaybePromise } from '../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { EmbeddedMapStateSource } from '../embedded-state-context'
import type { MapItemWithContent } from '../../game-maps/item-contract'
import type { MapSession } from '../../game-maps/session-contract'
import type { AnyItem } from '../../workspace/items'
import type { MapTransformStore } from './transform-state'

type MapPinSession = MapSession['pins']

export interface MapViewerSource extends EmbeddedMapStateSource {
  canEditMap: (map: MapItemWithContent) => boolean
  canViewItem: (item: AnyItem | null | undefined) => boolean
  createMapPins: MapPinSession['create']
  openItem: (
    itemId: SidebarItemId,
    options?: { heading?: string; replace?: boolean },
  ) => MaybePromise<void>
  removeMapPin: MapPinSession['remove']
  transformStore: MapTransformStore
  updateMapImage: MapSession['updateMapImage']
  updateMapPin: MapPinSession['update']
  updateMapPinVisibility: MapPinSession['setVisibility']
}
