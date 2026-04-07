import { useEffect } from 'react'
import { EditorContent } from '../components/editor-content'
import { FileTopbar } from '../components/topbar/file-topbar'
import { RightSidebar } from '../components/right-sidebar/right-sidebar'
import {
  RIGHT_SIDEBAR_CONTENT,
  RIGHT_SIDEBAR_DEFAULTS,
  RIGHT_SIDEBAR_PANEL_ID,
} from '../components/right-sidebar/constants'
import type { RightSidebarContentId } from '../components/right-sidebar/constants'
import { ResizableSidebar } from '~/features/sidebar/components/resizable-sidebar'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function EditorPage() {
  useSelectedItemSync()
  const { item } = useCurrentItem()
  const rightPanel = usePanelPreference(
    RIGHT_SIDEBAR_PANEL_ID,
    RIGHT_SIDEBAR_DEFAULTS,
  )

  useEffect(() => {
    rightPanel.setVisible(false)
  }, [item?._id])

  const activeContentId =
    (rightPanel.activeContentId as RightSidebarContentId | null) ??
    RIGHT_SIDEBAR_CONTENT.history

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <div className="relative flex flex-1 min-h-0 min-w-0">
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <EditorContent />
          </ErrorBoundary>
        </div>
        {rightPanel.visible && item && (
          <ResizableSidebar
            side="right"
            size={rightPanel.size}
            visible={rightPanel.visible}
            onSizeChange={rightPanel.setSize}
            onVisibleChange={rightPanel.setVisible}
            isLoaded={rightPanel.isLoaded}
            minWidth={200}
          >
            <RightSidebar
              itemId={item._id}
              activeContentId={activeContentId}
              onContentChange={rightPanel.setActiveContent}
              onClose={() => rightPanel.setVisible(false)}
            />
          </ResizableSidebar>
        )}
      </div>
    </div>
  )
}
