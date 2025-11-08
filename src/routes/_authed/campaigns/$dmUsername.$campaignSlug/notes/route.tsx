import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { SidebarLayout } from './-components/layout/sidebar-layout'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { NotesPageLayout } from './-components/page/index'
import { NotesEditor } from './-components/editor/notes-editor'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/notes',
)({
  component: NotesLayout,
})

function NotesLayout() {
  return (
    <ClientOnly>
      <SidebarLayout>
        <NotesPageLayout>
          <NotesEditor />
        </NotesPageLayout>
      </SidebarLayout>
    </ClientOnly>
  )
}
