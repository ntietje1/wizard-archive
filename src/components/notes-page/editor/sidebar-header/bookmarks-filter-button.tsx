import { Button } from '~/components/shadcn/ui/button'
import { Bookmark, BookmarkCheck } from '~/lib/icons'
import { useFileSidebar } from '~/hooks/useFileSidebar'

export function BookmarksFilterButton() {
  const { bookmarksOnlyMode, toggleBookmarksOnlyMode } = useFileSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleBookmarksOnlyMode}
      data-state={bookmarksOnlyMode ? 'active' : 'inactive'}
    >
      {bookmarksOnlyMode ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </Button>
  )
}
