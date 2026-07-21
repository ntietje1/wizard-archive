import { createFileRoute } from '@tanstack/react-router'
import { validateSearch } from '~/editor-adapters/workspace-route-search'
import { LiveWorkspacePage } from '~/editor-adapters/live/live-workspace-page'

export const Route = createFileRoute('/_app/_authed/campaigns/$dmUsername/$campaignSlug/editor')({
  component: LiveWorkspacePage,
  validateSearch,
})
