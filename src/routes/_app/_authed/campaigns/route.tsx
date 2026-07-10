import { createFileRoute } from '@tanstack/react-router'
import { CampaignsLayout } from './-campaigns-layout'

export const Route = createFileRoute('/_app/_authed/campaigns')({
  component: CampaignsLayout,
})
