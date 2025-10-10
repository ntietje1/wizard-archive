import { api } from 'convex/_generated/api'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { CreateActionCard } from '~/components/content-grid-page/create-action-card'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { MapPin, Plus, Edit, Trash2 } from '~/lib/icons'
import { useState } from 'react'
import type { Location } from 'convex/locations/types'
import LocationDialog from '../../../../../../../components/forms/category-tag-dialogs/location-tag-dialog/location-dialog'
import { toast } from 'sonner'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'
import { useCampaign } from '~/contexts/CampaignContext'
import { useRouter } from '@tanstack/react-router'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { LOCATION_CONFIG } from '~/components/forms/category-tag-dialogs/location-tag-dialog/types'

export default function LocationsContent() {
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign

  const locations = useQuery(
    convexQuery(
      api.locations.queries.getLocationsByCampaign,
      campaign?._id ? { campaignId: campaign?._id } : 'skip',
    ),
  )
  const router = useRouter()

  const [creatingLocation, setCreatingLocation] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteLocation = useMutation({
    mutationFn: useConvexMutation(api.locations.mutations.deleteLocation),
  })

  const handleViewLocationNotes = (location: Location) => {
    router.navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/categories/locations/$locationId',
      params: {
        dmUsername,
        campaignSlug,
        locationId: location.locationId,
      },
    })
  }

  const handleDeleteLocation = async () => {
    if (!deletingLocation) return

    setIsDeleting(true)

    try {
      await deleteLocation.mutateAsync({
        locationId: deletingLocation.locationId,
      })

      toast.success('Location deleted successfully')
      setDeletingLocation(null)
    } catch (_) {
      toast.error('Failed to delete location')
    } finally {
      setIsDeleting(false)
    }
  }

  if (
    campaignWithMembership.status === 'pending' ||
    locations.status === 'pending' ||
    !locations.data
  ) {
    return <LocationsContentLoading />
  }

  return (
    <>
      <ContentGrid>
        {locations.data.length > 0 && (
          <CreateActionCard
            onClick={() => setCreatingLocation(true)}
            title="New Location"
            description="Add a new location to your campaign"
            icon={MapPin}
          />
        )}

        {locations.data.map((location) => (
          <ContentCard
            key={location.locationId}
            title={location.name}
            description={location.description}
            color={location.color}
            badges={[
              {
                text: 'Location',
                icon: <MapPin className="w-3 h-3" />,
                variant: 'secondary',
              },
            ]}
            onClick={() => handleViewLocationNotes(location)}
            actionButtons={[
              {
                icon: <Edit className="w-4 h-4" />,
                onClick: (e) => {
                  e.stopPropagation()
                  setEditingLocation(location)
                },
                'aria-label': 'Edit location',
              },
              {
                icon: <Trash2 className="w-4 h-4" />,
                onClick: (e) => {
                  e.stopPropagation()
                  setDeletingLocation(location)
                },
                'aria-label': 'Delete location',
                variant: 'destructive-subtle',
              },
            ]}
          />
        ))}

        {locations.data.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            description="Create your first location to start organizing places in your campaign. Each location will automatically create a tag you can use in your notes."
            action={{
              label: 'Create First Location',
              onClick: () => setCreatingLocation(true),
              icon: Plus,
            }}
          />
        )}
      </ContentGrid>

      {creatingLocation && (
        <LocationDialog
          mode="create"
          isOpen={creatingLocation}
          onClose={() => setCreatingLocation(false)}
          config={LOCATION_CONFIG}
        />
      )}

      {editingLocation && (
        <LocationDialog
          mode="edit"
          isOpen={true}
          onClose={() => setEditingLocation(null)}
          config={LOCATION_CONFIG}
          tag={editingLocation}
        />
      )}

      <ConfirmationDialog
        isOpen={!!deletingLocation}
        onClose={() => setDeletingLocation(null)}
        onConfirm={handleDeleteLocation}
        title="Delete Location"
        description={`Are you sure you want to delete "${deletingLocation?.name}"? This will also remove all references to this location in your notes. This action cannot be undone.`}
        confirmLabel="Delete Location"
        isLoading={isDeleting}
        icon={MapPin}
      />
    </>
  )
}

function LocationsContentLoading() {
  return (
    <CardGridSkeleton count={6} showCreateCard={true} cardHeight="h-[180px]" />
  )
}
