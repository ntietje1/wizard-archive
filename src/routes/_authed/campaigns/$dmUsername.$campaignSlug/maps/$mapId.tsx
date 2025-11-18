import { createFileRoute, useNavigate, useParams, ClientOnly } from '@tanstack/react-router'
import { MapViewer } from '../categories/locations/-components/map-viewer'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/maps/$mapId',
)({
  component: MapPage,
})

function MapPage() {
  const params = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/maps/$mapId',
  })
  const navigate = useNavigate()
  const mapId = params.mapId as any

  const handleClose = () => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/categories/locations',
      params: {
        dmUsername: params.dmUsername,
        campaignSlug: params.campaignSlug,
      },
    })
  }

  return (
    <ClientOnly>
      <MapViewer mapId={mapId} onClose={handleClose} />
    </ClientOnly>
  )
}
