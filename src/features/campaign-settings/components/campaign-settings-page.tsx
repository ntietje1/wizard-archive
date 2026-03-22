import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { useForm } from '@tanstack/react-form'
import { api } from 'convex/_generated/api'
import { useConvex } from 'convex/react'
import {
  removeInvalidSlugCharacters,
  validateCampaignName,
  validateCampaignSlug,
} from 'convex/campaigns/validation'
import type { Id } from 'convex/_generated/dataModel'
import type { ConvexReactClient } from 'convex/react'
import { useCampaign } from '~/hooks/useCampaign'
import { LoadingPage } from '~/components/loading/loading-page'
import { Button } from '~/components/shadcn/ui/button'
import { Input } from '~/components/shadcn/ui/input'
import { Label } from '~/components/shadcn/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/shadcn/ui/select'
import { Switch } from '~/components/shadcn/ui/switch'
import { Textarea } from '~/components/shadcn/ui/textarea'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

async function validateCampaignSlugAsync(
  convex: ConvexReactClient,
  normalizedSlug: string,
  excludeCampaignId?: Id<'campaigns'>,
): Promise<string | null> {
  const exists = await convex.query(
    api.campaigns.queries.checkCampaignSlugExists,
    {
      slug: normalizedSlug,
      excludeCampaignId,
    },
  )
  return exists ? 'This link is already taken.' : null
}

export function CampaignSettingsPage() {
  const { campaign } = useCampaign()
  const campaignData = campaign.data
  const campaignStatus = campaign.status
  const convex = useConvex()

  const form = useForm({
    defaultValues: {
      name: campaignData?.name ?? '',
      description: campaignData?.description ?? '',
      slug: campaignData?.slug ?? '',
    },
    onSubmit: async () => {
      // TODO: wire to mutation endpoints when available
    },
  })

  if (campaignStatus === 'pending' || !campaignData) {
    return <LoadingPage />
  }

  const isDM = campaignData.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM

  if (!isDM) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          User Campaign Settings
        </h2>
        <p className="text-muted-foreground">settings go here</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-6 space-y-8">
        <div>
          <h2 className="text-2xl font-bold">Campaign Settings</h2>
          <p className="text-muted-foreground mt-1">
            {"Manage your campaign's configuration and preferences."}
          </p>
        </div>

        {/* Basic Information */}
        <div className="bg-card rounded-lg border border-border p-6">
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
                  <Label className="block text-sm font-medium text-foreground mb-1">
                    Campaign Name
                  </Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length ? (
                    <p className="text-sm text-destructive mt-1">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>

            <form.Field name="description">
              {(field) => (
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-1">
                    Description
                  </Label>
                  <Textarea
                    rows={3}
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
                  const normalized = removeInvalidSlugCharacters(trimmed)
                  return validateCampaignSlug(normalized)
                },
                onChangeAsync: async ({ value }) => {
                  const trimmed = value.trim()
                  const normalized = removeInvalidSlugCharacters(trimmed)
                  const syncError = validateCampaignSlug(normalized)
                  if (syncError) return syncError
                  return validateCampaignSlugAsync(
                    convex,
                    normalized,
                    campaignData._id,
                  )
                },
                onChangeAsyncDebounceMs: 300,
              }}
            >
              {(field) => (
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-1">
                    Campaign Slug
                  </Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    This appears in the URL. Use lowercase letters, numbers, and
                    hyphens only.
                  </p>
                </div>
              )}
            </form.Field>

            <Button type="submit">Save Changes</Button>
          </form>
        </div>

        {/* Privacy & Access */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Privacy & Access</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Campaign Visibility</h4>
                <p className="text-sm text-muted-foreground">
                  Control who can see your campaign
                </p>
              </div>
              <Select defaultValue="private">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="friends">Friends Only</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Allow Player Invitations</h4>
                <p className="text-sm text-muted-foreground">
                  Let players invite others to join
                </p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Allow Character Creation</h4>
                <p className="text-sm text-muted-foreground">
                  Let players create new characters
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Game Rules */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4">Game Rules</h3>
          <div className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-foreground mb-1">
                Game System
              </Label>
              <Select defaultValue="5e">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5e">D&D 5th Edition</SelectItem>
                  <SelectItem value="pathfinder">Pathfinder</SelectItem>
                  <SelectItem value="3.5e">D&D 3.5 Edition</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium text-foreground mb-1">
                Starting Level
              </Label>
              <Input type="number" min={1} max={20} defaultValue={1} />
            </div>

            <div>
              <Label className="block text-sm font-medium text-foreground mb-1">
                House Rules
              </Label>
              <Textarea
                rows={4}
                placeholder="Any special rules or modifications for this campaign..."
              />
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card rounded-lg border border-destructive/30 p-6">
          <h3 className="text-lg font-semibold text-destructive mb-4">
            Danger Zone
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-destructive">
                  Archive Campaign
                </h4>
                <p className="text-sm text-destructive">
                  Hide this campaign from active campaigns
                </p>
              </div>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/15"
              >
                Archive
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-destructive">
                  Delete Campaign
                </h4>
                <p className="text-sm text-destructive">
                  Permanently delete this campaign and all its data
                </p>
              </div>
              <Button variant="destructive">Delete</Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
