import { createFileRoute } from '@tanstack/react-router'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { useForm } from '@tanstack/react-form'
import { useConvex } from 'convex/react'
import {
  removeInvalidCharacters,
  validateCampaignName,
  validateCampaignSlugAsync,
  validateCampaignSlugSync,
} from '../../-components/campaign-form-validators'
import { useCampaign } from '~/contexts/CampaignContext'
import { LoadingPage } from '~/components/loading/loading-page'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/settings/',
)({
  component: CampaignSettingsPage,
})

function CampaignSettingsPage() {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign
  const campaignStatus = campaignWithMembership.status
  const convex = useConvex()

  const form = useForm({
    defaultValues: {
      name: campaign?.name ?? '',
      description: campaign?.description ?? '',
      slug: campaign?.slug ?? '',
    },
    onSubmit: async () => {
      // TODO: wire to mutation endpoints when available
    },
  })

  if (campaignStatus === 'pending' || !campaign) {
    return <LoadingPage />
  }

  const isDM =
    campaignWithMembership.data?.member.role === CAMPAIGN_MEMBER_ROLE.DM

  if (!isDM) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          User Campaign Settings
        </h2>
        <p className="text-gray-600">settings go here</p>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Campaign Settings</h2>
        <p className="text-gray-600 mt-1">
          {"Manage your campaign's configuration and preferences."}
        </p>
      </div>

      {/* Basic Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="name"
            validators={{
              onChange: () => undefined,
              onBlur: ({ value }) => validateCampaignName(value),
            }}
          >
            {(field) => (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name
                </Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length ? (
                  <p className="text-sm text-red-500 mt-1">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </Label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <form.Field
            name="slug"
            validators={{
              onChange: () => undefined,
              onBlur: ({ value }) => {
                const trimmed = value.trim()
                const normalized = removeInvalidCharacters(trimmed)
                return validateCampaignSlugSync(normalized)
              },
              onChangeAsync: async ({ value }) => {
                const trimmed = value.trim()
                const normalized = removeInvalidCharacters(trimmed)
                const syncError = validateCampaignSlugSync(normalized)
                if (syncError) return syncError
                return validateCampaignSlugAsync(
                  convex,
                  normalized,
                  campaign._id,
                )
              },
              onChangeAsyncDebounceMs: 300,
            }}
          >
            {(field) => (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Slug
                </Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <p className="text-sm text-gray-500 mt-1">
                  This appears in the URL. Use lowercase letters, numbers, and
                  hyphens only.
                </p>
              </div>
            )}
          </form.Field>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* Privacy & Access */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Privacy & Access</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Campaign Visibility</h4>
              <p className="text-sm text-gray-600">
                Control who can see your campaign
              </p>
            </div>
            <select className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="private">Private</option>
              <option value="friends">Friends Only</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Allow Player Invitations</h4>
              <p className="text-sm text-gray-600">
                Let players invite others to join
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Allow Character Creation</h4>
              <p className="text-sm text-gray-600">
                Let players create new characters
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
            </label>
          </div>
        </div>
      </div>

      {/* Game Rules */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Game Rules</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Game System
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="5e">D&D 5th Edition</option>
              <option value="pathfinder">Pathfinder</option>
              <option value="3.5e">D&D 3.5 Edition</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Starting Level
            </label>
            <input
              type="number"
              min="1"
              max="20"
              defaultValue="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              House Rules
            </label>
            <textarea
              rows={4}
              placeholder="Any special rules or modifications for this campaign..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-red-900">Archive Campaign</h4>
              <p className="text-sm text-red-700">
                Hide this campaign from active campaigns
              </p>
            </div>
            <button className="bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200">
              Archive
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-red-900">Delete Campaign</h4>
              <p className="text-sm text-red-700">
                Permanently delete this campaign and all its data
              </p>
            </div>
            <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
