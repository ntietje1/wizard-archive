import { Search } from 'lucide-react'
import { useSearchStore } from '~/features/search/stores/search-store'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'

// TODO: change this to be platform agnostic when using tanstack hotkeys
export function SearchButton() {
  const open = useSearchStore((s) => s.open)
  return (
    <TooltipButton tooltip="Search (Ctrl+K)" side="bottom">
      <Button variant="ghost" size="icon" onClick={open} aria-label="Search">
        <Search className="h-4 w-4" />
      </Button>
    </TooltipButton>
  )
}
