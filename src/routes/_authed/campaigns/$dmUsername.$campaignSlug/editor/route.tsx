import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { SidebarLayout } from '~/components/notes-page/sidebar/sidebar-layout'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { validateSearch } from '~/components/notes-page/validate-search'
import { FileTopbar } from '~/components/notes-page/editor/topbar/file-topbar'
import { EditorContent } from '~/components/notes-page/editor/editor-content'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
)({
  component: EditorLayout,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function EditorLayout() {
  return (
    <ClientOnly>
      <SidebarLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <FileTopbar />
          <EditorContent />
        </div>
      </SidebarLayout>
    </ClientOnly>
  )
}
