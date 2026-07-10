import { MapPin } from 'lucide-react'
import type { MapItem } from '../../game-maps/item-contract'
import { PreviewImageResourceItemCard } from '../../filesystem/cards/preview-image-card'
import type { ResourceItemCardProps } from '../../filesystem/cards/shell'

export function MapCard(props: ResourceItemCardProps<MapItem>) {
  return (
    <PreviewImageResourceItemCard
      {...props}
      fallbackIcon={MapPin}
      fallbackLabel="Map preview unavailable"
      imageAlt={(map) => map.name}
    />
  )
}
