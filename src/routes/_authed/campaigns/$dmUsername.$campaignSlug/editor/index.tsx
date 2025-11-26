import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/editor/',
)({
  component: () => null,
})
