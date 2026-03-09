import { createFileRoute } from '@tanstack/react-router'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { api } from 'convex/_generated/api'
import { prefetchQuery } from '~/lib/prefetch'
import { validateSearch } from '~/components/notes-page/validate-search'
import { FileTopbar } from '~/components/notes-page/editor/topbar/file-topbar'
import { EditorContent } from '~/components/notes-page/editor/editor-content'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'
import { useSelectedItemSync } from '~/hooks/useSelectedItem'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
)({
  beforeLoad: async ({ context, params, search }) => {
    const campaign = await prefetchQuery(
      context.queryClient,
      api.campaigns.queries.getCampaignBySlug,
      { dmUsername: params.dmUsername, slug: params.campaignSlug },
    )
    const typeAndSlug = getTypeAndSlug(search)
    if (campaign?._id) {
      await Promise.all([
        prefetchQuery(
          context.queryClient,
          api.sidebarItems.queries.getAllSidebarItems,
          { campaignId: campaign._id },
        ),
        prefetchQuery(
          context.queryClient,
          api.editors.queries.getCurrentEditor,
          { campaignId: campaign._id },
        ),
        prefetchQuery(
          context.queryClient,
          api.campaigns.queries.getPlayersByCampaign,
          { campaignId: campaign._id },
        ),
        typeAndSlug &&
          prefetchQuery(
            context.queryClient,
            api.sidebarItems.queries.getSidebarItemBySlug,
            {
              campaignId: campaign._id,
              type: typeAndSlug.type,
              slug: typeAndSlug.slug,
            },
          ),
      ])
    }
  },
  component: EditorLayout,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function EditorLayout() {
  useSelectedItemSync()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <EditorContent />
    </div>
  )
}
