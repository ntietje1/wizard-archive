import { createFileRoute } from '@tanstack/react-router'
import { SidebarLayout } from '~/components/notes-page/sidebar/sidebar-layout'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { validateSearch } from '~/components/notes-page/validate-search'
import { FileTopbar } from '~/components/notes-page/editor/topbar/file-topbar'
import { EditorContent } from '~/components/notes-page/editor/editor-content'
import { EditorModeProvider } from '~/contexts/EditorModeContext'
import { EditorHeader } from '~/components/notes-page/editor/editor-header'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
)({
  component: EditorLayout,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function EditorLayout() {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <EditorHeader />
      <SidebarLayout>
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
          <EditorModeProvider>
            <FileTopbar />
            <EditorContent />
          </EditorModeProvider>
        </div>
      </SidebarLayout>
    </div>
  )
}
