import { AnimatePresence, motion } from 'motion/react'
import { Eye, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { useEditorModeActions, useEditorModeState } from '~/hooks/useEditorMode'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { Button } from '~/components/shadcn/ui/button'

export function ViewAsBanner() {
  const { viewAsPlayerId } = useEditorModeState()
  const { setViewAsPlayerId } = useEditorModeActions()
  const campaignMembersQuery = useCampaignMembers()

  const playerMember = campaignMembersQuery.data?.find(
    (member) =>
      member._id === viewAsPlayerId &&
      member.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const displayName = playerMember
    ? playerMember.userProfile.name ||
      (playerMember.userProfile.username
        ? `@${playerMember.userProfile.username}`
        : 'Player')
    : null

  return (
    <AnimatePresence>
      {viewAsPlayerId && displayName && (
        <motion.div
          key="view-as-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 h-8 border-b bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800/50 dark:text-amber-200 z-10">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Eye className="h-3.5 w-3.5" />
              <span>
                Viewing as <span className="font-semibold">{displayName}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-100 dark:hover:bg-amber-800/50"
              onClick={() => setViewAsPlayerId(undefined)}
            >
              <X className="h-3 w-3 mr-0.5" />
              Exit
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
