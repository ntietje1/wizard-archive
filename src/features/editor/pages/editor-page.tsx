import { useEffect } from 'react'
import { EditorContent } from '../components/editor-content'
import { FileTopbar } from '../components/topbar/file-topbar'
import { HistoryPanel } from '../components/history-panel'
import { ResizableSidebar } from '~/features/sidebar/components/resizable-sidebar'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { ErrorBoundary } from '~/shared/components/error-boundary'
import { ErrorFallback } from '~/shared/components/error-fallback'

export function EditorPage() {
  useSelectedItemSync()
  const { item } = useCurrentItem()
  const historyPanel = usePanelPreference('editor-history', {
    size: 300,
    visible: false,
  })

  useEffect(() => {
    historyPanel.setVisible(false)
  }, [item?._id])

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <div className="relative flex flex-1 min-h-0 min-w-0">
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <EditorContent />
          </ErrorBoundary>
        </div>
        {historyPanel.visible && item && (
          <ResizableSidebar
            side="right"
            size={historyPanel.size}
            visible={historyPanel.visible}
            onSizeChange={historyPanel.setSize}
            onVisibleChange={historyPanel.setVisible}
            isLoaded={historyPanel.isLoaded}
            minWidth={200}
          >
            <HistoryPanel
              itemId={item._id}
              onClose={() => historyPanel.setVisible(false)}
            />
          </ResizableSidebar>
        )}
      </div>
    </div>
  )
}
