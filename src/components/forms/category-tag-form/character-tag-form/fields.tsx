import { Label } from '~/components/shadcn/ui/label'
import type { Id } from 'convex/_generated/dataModel'

interface CampaignMember {
  _id: Id<'campaignMembers'>
  userProfile: {
    name?: string
    username?: string
  }
}

interface PlayerFieldProps {
  field: {
    state: {
      value: any
    }
    handleChange: (value: any) => void
    handleBlur: () => void
  }
  players: CampaignMember[]
  isDisabled: boolean
}

export function PlayerField({ field, players, isDisabled }: PlayerFieldProps) {
  const currentValue = field.state.value ?? ''

  return (
    <div className="space-y-2 px-px">
      <Label htmlFor="character-player">Player</Label>
      <select
        id="character-player"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={currentValue}
        onChange={(e) => {
          const value = e.target.value
          field.handleChange(value === '' ? undefined : value)
        }}
        onBlur={field.handleBlur}
        disabled={isDisabled}
      >
        <option value="">Select a player (optional)...</option>
        {players.map((option) => (
          <option key={option._id} value={option._id}>
            {option.userProfile.name || option.userProfile.username || 'Member'}
          </option>
        ))}
      </select>
    </div>
  )
}
