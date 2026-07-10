import { FileText } from 'lucide-react'
import type { NoteItem } from '../../notes/item-contract'
import { PreviewImageResourceItemCard } from '../../filesystem/cards/preview-image-card'
import type { ResourceItemCardProps } from '../../filesystem/cards/shell'

export function NoteCard(props: ResourceItemCardProps<NoteItem>) {
  return (
    <PreviewImageResourceItemCard
      {...props}
      fallbackIcon={FileText}
      fallbackLabel="Note preview unavailable"
      imageAlt={(note) => note.name}
      imageClassName="object-top"
      imageDraggable={false}
    />
  )
}
