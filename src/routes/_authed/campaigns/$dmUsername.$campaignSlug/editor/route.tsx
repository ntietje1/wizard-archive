import { createFileRoute } from '@tanstack/react-router'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { validateSearch } from '~/features/sidebar/utils/validate-search'
import { EditorPage } from '~/features/editor/pages/editor-page'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
)({
  component: EditorPage,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})
