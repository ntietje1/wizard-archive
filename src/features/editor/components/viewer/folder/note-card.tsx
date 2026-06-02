import { useState } from 'react'
import { ClientOnly } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import type { ItemCardProps } from './item-card'
import type { Note } from 'shared/notes/types'
import { Card } from '~/features/shadcn/components/card'
import { cn } from '~/features/shadcn/lib/utils'
import { sidebarItemIconClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { useSidebarItemVisualState } from '~/features/sidebar/hooks/useSelectedItem'
import { FolderItemCardShell } from './folder-item-card-shell'

function NoteCardSkeleton() {
  return (
    <div className="w-full h-[140px]">
      <Card className="w-full h-full flex flex-col p-2 relative rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div className="bg-muted rounded-md h-5 w-32" />
          <div className="bg-muted rounded-md size-6" />
        </div>
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          <div className="bg-muted w-full h-full" />
        </div>
      </Card>
    </div>
  )
}

function NoteCardInner({ item: note, ...props }: ItemCardProps<Note>) {
  const [erroredUrl, setErroredUrl] = useState<string | null>(null)
  const imgError = erroredUrl === note.previewUrl
  const visualState = useSidebarItemVisualState(note)

  return (
    <FolderItemCardShell
      {...props}
      item={note}
      visualState={visualState}
      preview={
        <div className="w-full flex-1 bg-muted relative rounded-sm overflow-hidden">
          {note.previewUrl && !imgError ? (
            <img
              src={note.previewUrl}
              alt={note.name}
              className="w-full h-full object-cover object-top"
              loading="lazy"
              draggable={false}
              onError={() => setErroredUrl(note.previewUrl)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className={cn('size-12', sidebarItemIconClass(visualState))} />
            </div>
          )}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10" />
        </div>
      }
    />
  )
}

export function NoteCard(props: ItemCardProps<Note>) {
  if (props.isLoading) {
    return <NoteCardSkeleton />
  }

  return (
    <ClientOnly fallback={<NoteCardSkeleton />}>
      <NoteCardInner {...props} />
    </ClientOnly>
  )
}
