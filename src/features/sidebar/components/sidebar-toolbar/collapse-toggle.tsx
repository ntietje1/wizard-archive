import { PanelLeft, PanelLeftOpen } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { useSidebarLayout } from '~/features/sidebar/hooks/useSidebarLayout'

export function CollapseToggle() {
  const { isSidebarExpanded, setIsSidebarExpanded } = useSidebarLayout()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
      aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {isSidebarExpanded ? (
        <PanelLeft className="h-4 w-4" />
      ) : (
        <PanelLeftOpen className="h-4 w-4" />
      )}
    </Button>
  )
}
