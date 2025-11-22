import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  validateSearch,
  type CategorySearch,
} from '../$categorySlug/-components/validateFolderId'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters/',
)({
  beforeLoad: ({ params, search }) => {
    const folderId = (search as CategorySearch)?.folderId
    throw redirect({
      to: '/campaigns/$dmUsername/$campaignSlug/notes',
      params: {
        dmUsername: params.dmUsername,
        campaignSlug: params.campaignSlug,
      },
      search: {
        categorySlug: 'characters',
        ...(folderId && { folderId }),
      },
    })
  },
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})
