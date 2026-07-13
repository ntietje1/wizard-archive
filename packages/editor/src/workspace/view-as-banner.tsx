import { Eye, X } from 'lucide-react'
import { Banner, BannerButton } from '@wizard-archive/ui/components/banner'
import type { ViewAsParticipantCapability } from '../sharing/contracts'

export function ViewAsBanner({ viewAsPlayer }: { viewAsPlayer: ViewAsParticipantCapability }) {
  if (viewAsPlayer.status !== 'available') return null

  const participant = viewAsPlayer.selectedParticipantId
    ? viewAsPlayer.participants.find(
        (candidate) => candidate.id === viewAsPlayer.selectedParticipantId,
      )
    : null
  if (!participant) return null

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-50 border-[3px] border-mode-view-as-border" />

      <div className="absolute inset-x-0 bottom-0 z-50 overflow-hidden">
        <Banner
          icon={<Eye className="size-3.5" />}
          variant="accent"
          border="top"
          actions={
            <BannerButton onClick={() => viewAsPlayer.setSelectedParticipantId(undefined)}>
              <X className="mr-0.5 size-3" />
              Exit
            </BannerButton>
          }
        >
          Viewing as{' '}
          <span className="font-semibold">
            {participant.displayName ||
              (participant.username ? `@${participant.username}` : 'Player')}
          </span>
        </Banner>
      </div>
    </>
  )
}
