import { History } from 'lucide-react'
import { ContextMenuButton } from '../editor-action-buttons'
import { ShareButton } from '../share-button'
import { ViewAsPlayerButton } from '../view-as-button'
import { useHistoryPanel } from '../../use-history-panel'
import type { ReactNode } from 'react'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

export const ItemButtonWrapper = ({
  children,
  isTrashView,
}: {
  children?: ReactNode | undefined
  isTrashView?: boolean
}) => {
  const { isOpen, toggle } = useHistoryPanel()

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {children}
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-7 w-7', isOpen && 'bg-accent')}
        onClick={toggle}
        title="History"
      >
        <History className="h-4 w-4" />
      </Button>
      <ShareButton />
      <ViewAsPlayerButton />
      <ContextMenuButton isTrashView={isTrashView} />
    </div>
  )
}
