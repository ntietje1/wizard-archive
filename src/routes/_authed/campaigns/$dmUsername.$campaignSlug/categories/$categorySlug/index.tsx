import {
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import {
  validateSearch,
  type CategorySearch,
} from './-components/validateFolderId'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
)({
  beforeLoad: ({ params, search }) => {
    const categorySlug = params.categorySlug
    const folderId = (search as CategorySearch)?.folderId
    throw redirect({
      to: '/campaigns/$dmUsername/$campaignSlug/notes',
      params: {
        dmUsername: params.dmUsername,
        campaignSlug: params.campaignSlug,
      },
      search: {
        categorySlug,
        ...(folderId && { folderId }),
      },
    })
  },
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})
