import { Grid2x2Plus } from 'lucide-react'
import type { CanvasItem } from '../item-contract'
import { PreviewImageResourceItemCard } from '../../filesystem/cards/preview-image-card'
import type { ResourceItemCardProps } from '../../filesystem/cards/shell'

export function CanvasCard(props: ResourceItemCardProps<CanvasItem>) {
  return (
    <PreviewImageResourceItemCard
      {...props}
      fallbackIcon={Grid2x2Plus}
      fallbackLabel="Canvas preview unavailable"
      imageAlt={(canvas) => `Preview of ${canvas.name}`}
    />
  )
}
