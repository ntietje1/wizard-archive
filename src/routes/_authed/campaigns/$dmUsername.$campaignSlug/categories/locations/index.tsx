import { createFileRoute } from '@tanstack/react-router'
import LocationsContent from './-components/locations-content'
import LocationsHeader from './-components/locations-header'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/locations/',
)({
  component: LocationsIndexPage,
})

function LocationsIndexPage() {
  return (
    <div className="flex-1 p-6">
      <LocationsHeader />
      <LocationsContent />
    </div>
  )
}
