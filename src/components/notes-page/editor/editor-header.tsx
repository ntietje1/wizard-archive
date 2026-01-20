import { PanelLeft, PanelLeftOpen } from 'lucide-react'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { TooltipButton } from '~/components/tooltips/tooltip-button'
import { Button } from '~/components/shadcn/ui/button'

export function EditorHeader() {
  const { isSidebarExpanded, setIsSidebarExpanded } = useFileSidebar()

  return (
    <div className="flex items-center h-10 border-b bg-background px-2 shrink-0">
      <TooltipButton
        tooltip={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
        >
          {isSidebarExpanded ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>
      </TooltipButton>
    </div>
  )
}
