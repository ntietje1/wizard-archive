import { createFileRoute } from '@tanstack/react-router'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { validateSearch } from '~/components/notes-page/validate-search'
import { FileTopbar } from '~/components/notes-page/editor/topbar/file-topbar'
import { EditorContent } from '~/components/notes-page/editor/editor-content'
import { getTypeAndSlug } from '~/lib/sidebar-item-utils'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
)({
  beforeLoad: async ({ context, params, search }) => {
    const campaignWithMembership = await context.queryClient.ensureQueryData(
      convexQuery(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: params.dmUsername,
        slug: params.campaignSlug,
      }),
    )
    const typeAndSlug = getTypeAndSlug(search)

    if (campaignWithMembership?.campaign._id) {
      await Promise.all([
        context.queryClient.ensureQueryData(
          convexQuery(api.sidebarItems.queries.getAllSidebarItems, {
            campaignId: campaignWithMembership.campaign._id,
          }),
        ),
        context.queryClient.ensureQueryData(
          convexQuery(api.editors.queries.getCurrentEditor, {
            campaignId: campaignWithMembership.campaign._id,
          }),
        ),
        context.queryClient.ensureQueryData(
          convexQuery(api.campaigns.queries.getPlayersByCampaign, {
            campaignId: campaignWithMembership.campaign._id,
          }),
        ),
        typeAndSlug &&
          context.queryClient.ensureQueryData(
            convexQuery(api.sidebarItems.queries.getSidebarItemBySlug, {
              campaignId: campaignWithMembership.campaign._id,
              type: typeAndSlug.type,
              slug: typeAndSlug.slug,
            }),
          ),
      ])
    }
  },
  component: EditorLayout,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function EditorLayout() {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <FileTopbar />
      <EditorContent />
    </div>
  )
}
