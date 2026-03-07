import { AnimatePresence, motion } from 'motion/react'
import { Eye, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { useEditorMode } from '~/hooks/useEditorMode'
import { useCampaignMembers } from '~/hooks/useCampaignMembers'
import { Button } from '~/components/shadcn/ui/button'

export function ViewAsBanner() {
  const { viewAsPlayerId, setViewAsPlayerId } = useEditorMode()
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

  const isActive = !!(viewAsPlayerId && displayName)

  return (
    <>
      {/* Screen rim — fixed inset border around entire viewport */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="view-as-rim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 pointer-events-none border-[3px] border-primary/60 dark:border-primary/70"
          />
        )}
      </AnimatePresence>

      {/* Bottom banner */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="view-as-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 h-8 border-t border-primary/40 bg-accent text-accent-foreground">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Eye className="h-3.5 w-3.5" />
                <span>
                  Viewing as{' '}
                  <span className="font-semibold">{displayName}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-xs text-accent-foreground hover:text-accent-foreground hover:bg-accent dark:text-primary dark:hover:text-primary dark:hover:bg-accent"
                onClick={() => setViewAsPlayerId(undefined)}
              >
                <X className="h-3 w-3 mr-0.5" />
                Exit
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
