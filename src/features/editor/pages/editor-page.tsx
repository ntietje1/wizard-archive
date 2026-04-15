import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { EditorContent } from '../components/editor-content'
import { FileTopbar } from '../components/topbar/file-topbar'
import { TrashBanner } from '../components/deleted-item-banner'
import { RightSidebarContainer } from '../components/right-sidebar/right-sidebar-container'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function EditorPage() {
  useSelectedItemSync()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <EditorBanner />
      <div className="relative flex flex-1 min-h-0 min-w-0">
        <div className="relative flex flex-col flex-1 min-h-0 min-w-0">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <EditorContent />
          </ErrorBoundary>
        </div>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <RightSidebarContainer />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function EditorBanner() {
  const { item, isLoading } = useCurrentItem()
  if (isLoading || !item || item.location !== SIDEBAR_ITEM_LOCATION.trash) return null
  return <TrashBanner item={item} />
}
