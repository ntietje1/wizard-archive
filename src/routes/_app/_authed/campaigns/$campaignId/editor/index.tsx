import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/_authed/campaigns/$campaignId/editor/')({
  component: () => null,
})
