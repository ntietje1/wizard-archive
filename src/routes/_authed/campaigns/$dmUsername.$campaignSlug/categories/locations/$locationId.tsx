import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/locations/$locationId',
)({
  component: LocationDetailPage,
})

function LocationDetailPage() {
  const locationId = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/locations/$locationId',
  })?.locationId

  const location = useQuery(
    convexQuery(api.locations.queries.getLocationById, {
      locationId: locationId as Id<'locations'>,
    }),
  )

  if (location.status === 'error') {
    return <div>Error</div>
  }

  if (location.status === 'pending') {
    return <div>Loading...</div>
  }

  return <div>{location.data?.name}</div>
}
