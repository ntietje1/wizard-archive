import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { SidebarLayout } from '~/components/notes-page/sidebar/sidebar-layout'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { EditorContent } from '~/components/notes-page/notes-content'
import {
  validateSearch,
} from '~/components/notes-page/validate-search'
import { FileTopbar } from '~/components/notes-page/editor/file-topbar/topbar'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
)({
  component: NotesLayout,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function NotesLayout() {
  return (
    <ClientOnly>
      <SidebarLayout>
        <div className="flex-1 min-h-0 flex flex-col">
          <FileTopbar />
          <EditorContent />
        </div>
      </SidebarLayout>
    </ClientOnly>
  )
}
