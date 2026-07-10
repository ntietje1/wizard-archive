import { useNavigate, useParams } from '@tanstack/react-router'
import { parseCampaignSlug } from 'shared/campaigns/validation'
import { useConvexAuth } from 'convex/react'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { parseUsername } from 'shared/users/validation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@wizard-archive/ui/shadcn/components/card'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Header } from '~/shared/components/header'
import { SignInForm } from '~/features/auth/components/sign-in-form'
import { useJoinCampaignMutation } from '~/features/campaigns/hooks/use-campaign-operations'
import { useJoinCampaignQuery } from '~/features/campaigns/hooks/use-join-campaign-query'
import { StatusIcon } from '~/features/campaigns/components/status-icon'
import { resolveCampaignLookupState } from '~/features/campaigns/campaign-lookup-state'
import type { Campaign, CampaignMemberSummary } from 'shared/campaigns/types'
import type { CampaignLookupState } from '~/features/campaigns/campaign-lookup-state'

type JoinCampaignCardContent = {
  title: string
  description: ReactNode
  statusVariant: 'loading' | 'warning' | 'error' | 'success'
  titleColor: string
  children: ReactNode
}

type JoinCampaignCardContentOptions = {
  campaignLookupState: CampaignLookupState
  campaignMember: CampaignMemberSummary | null | undefined
  isAuthLoading: boolean
  isAuthenticated: boolean
  joinCampaignStatus: string
  onGoCampaignHome: () => void
  onGoHome: () => void
  onJoinCampaign: () => void
  onShowSignIn: () => void
}

function LoadingInvitationState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}

function CampaignInvitationSummary({ campaign }: { campaign: Campaign }) {
  return (
    <div className="relative p-6 bg-muted rounded-lg border border-border">
      <div className="absolute top-4 right-4 size-2 bg-primary/60 rounded-full" />
      <h3 className="font-bold text-foreground mb-3 text-lg text-left">{campaign.name}</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed text-left">
        {campaign.description || 'No description provided'}
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="p-1.5 bg-secondary rounded-full">
          <Users className="size-3.5" />
        </div>
        <span>
          Campaign by{' '}
          <span className="font-medium text-foreground">@{campaign.dmUserProfile.username}</span>
        </span>
      </div>
    </div>
  )
}

function buildJoinCampaignCardContent({
  campaignLookupState,
  campaignMember,
  isAuthLoading,
  isAuthenticated,
  joinCampaignStatus,
  onGoCampaignHome,
  onGoHome,
  onJoinCampaign,
  onShowSignIn,
}: JoinCampaignCardContentOptions): JoinCampaignCardContent {
  if (isAuthLoading) {
    return {
      title: 'Loading User…',
      description: 'Please wait a moment.',
      statusVariant: 'loading',
      titleColor: 'text-foreground',
      children: <LoadingInvitationState />,
    }
  }

  const loadedCampaign =
    campaignLookupState.status === 'ready' ? campaignLookupState.campaign : undefined

  if (!isAuthenticated) return unauthenticatedCardContent(loadedCampaign, onShowSignIn)

  if (campaignLookupState.status === 'loading') {
    return {
      title: 'Loading Campaign…',
      description: 'Please wait a moment.',
      statusVariant: 'loading',
      titleColor: 'text-foreground',
      children: <LoadingInvitationState />,
    }
  }

  if (campaignLookupState.status === 'failed') {
    return {
      title: 'Could Not Load Campaign',
      description: 'Something went wrong while loading this campaign. Please try again.',
      statusVariant: 'error',
      titleColor: 'text-destructive',
      children: (
        <Button
          onClick={() => void campaignLookupState.retry()}
          className="w-full h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
        >
          Try Again
        </Button>
      ),
    }
  }

  if (campaignLookupState.status === 'not_found_or_forbidden') {
    return {
      title: 'Campaign Not Found',
      description: "The campaign link you're trying to access doesn't exist or has been removed.",
      statusVariant: 'error',
      titleColor: 'text-destructive',
      children: <BrowseCampaignsButton onClick={onGoHome} />,
    }
  }

  const campaign = campaignLookupState.campaign

  if (campaignMember?.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return dmCardContent(campaign, onGoCampaignHome)
  }

  const memberContent = memberStatusCardContent(
    campaign,
    campaignMember,
    onGoCampaignHome,
    onGoHome,
  )
  if (memberContent) return memberContent

  return joinRequestCardContent(campaign, joinCampaignStatus, onJoinCampaign)
}

function BrowseCampaignsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
    >
      Browse Campaigns
    </Button>
  )
}

function unauthenticatedCardContent(
  campaign: Campaign | undefined,
  onShowSignIn: () => void,
): JoinCampaignCardContent {
  return {
    title: "You've Been Invited!",
    description: campaign ? (
      <>
        {campaign.dmUserProfile.name} has invited you to join <strong>{campaign.name}</strong>
      </>
    ) : (
      "You've been invited to join a campaign."
    ),
    statusVariant: 'warning',
    titleColor: 'text-foreground',
    children: campaign ? (
      <div className="flex flex-col gap-6">
        <CampaignInvitationSummary campaign={campaign} />
        <SignInButton onClick={onShowSignIn} />
      </div>
    ) : (
      <SignInButton onClick={onShowSignIn} />
    ),
  }
}

function SignInButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
    >
      Sign In to Join
    </Button>
  )
}

function dmCardContent(campaign: Campaign, onGoCampaignHome: () => void): JoinCampaignCardContent {
  return {
    title: "You're the DM",
    description: (
      <>
        This is your campaign, <strong>{campaign.name}</strong>. Share the link with your players so
        they can join.
      </>
    ),
    statusVariant: 'warning',
    titleColor: 'text-foreground',
    children: (
      <div className="flex flex-col gap-3">
        <GoToCampaignButton onClick={onGoCampaignHome} />
      </div>
    ),
  }
}

function GoToCampaignButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
    >
      Go to Campaign
    </Button>
  )
}

function memberStatusCardContent(
  campaign: Campaign,
  campaignMember: CampaignMemberSummary | null | undefined,
  onGoCampaignHome: () => void,
  onGoHome: () => void,
): JoinCampaignCardContent | null {
  switch (campaignMember?.status) {
    case CAMPAIGN_MEMBER_STATUS.Pending:
      return pendingMemberCardContent(campaign)
    case CAMPAIGN_MEMBER_STATUS.Accepted:
      return acceptedMemberCardContent(campaign, onGoCampaignHome)
    case CAMPAIGN_MEMBER_STATUS.Rejected:
      return rejectedMemberCardContent(campaign, onGoHome)
    case CAMPAIGN_MEMBER_STATUS.Removed:
      return removedMemberCardContent(campaign, onGoHome)
    default:
      return null
  }
}

function pendingMemberCardContent(campaign: Campaign): JoinCampaignCardContent {
  return {
    title: 'Request Sent',
    description: (
      <>
        Your request to join <strong>{campaign.name}</strong> has been sent.{' '}
        {"You'll gain access once the DM confirms your request."}
      </>
    ),
    statusVariant: 'warning',
    titleColor: 'text-foreground',
    children: (
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-accent rounded-lg border border-primary/30">
          <p className="text-sm text-accent-foreground font-medium">
            This page will automatically update when you gain access.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="size-2 bg-primary/60 rounded-full" />
          <span>Waiting for DM approval</span>
        </div>
      </div>
    ),
  }
}

function acceptedMemberCardContent(
  campaign: Campaign,
  onGoCampaignHome: () => void,
): JoinCampaignCardContent {
  return {
    title: "You're In!",
    description: (
      <>
        You now have access to <strong>{campaign.name}</strong>.
      </>
    ),
    statusVariant: 'success',
    titleColor: 'text-foreground',
    children: <GoToCampaignButton onClick={onGoCampaignHome} />,
  }
}

function rejectedMemberCardContent(
  campaign: Campaign,
  onGoHome: () => void,
): JoinCampaignCardContent {
  return {
    title: 'Request Rejected',
    description: (
      <>
        Your request to join <strong>{campaign.name}</strong> has been rejected.
      </>
    ),
    statusVariant: 'error',
    titleColor: 'text-destructive',
    children: <ExitButton onClick={onGoHome} />,
  }
}

function removedMemberCardContent(
  campaign: Campaign,
  onGoHome: () => void,
): JoinCampaignCardContent {
  return {
    title: "You've Been Removed",
    description: (
      <p>
        {"You've been removed from "}
        <strong>{campaign.name}</strong>
        {'.'}
      </p>
    ),
    statusVariant: 'error',
    titleColor: 'text-destructive',
    children: <ExitButton onClick={onGoHome} />,
  }
}

function ExitButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="w-full h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
    >
      Exit
    </Button>
  )
}

function joinRequestCardContent(
  campaign: Campaign,
  joinCampaignStatus: string,
  onJoinCampaign: () => void,
): JoinCampaignCardContent {
  if (joinCampaignStatus === 'error') {
    return {
      title: 'Failed to Join',
      description: 'Something went wrong while trying to join. Please try again.',
      statusVariant: 'error',
      titleColor: 'text-destructive',
      children: (
        <Button
          onClick={onJoinCampaign}
          className="w-full h-12 bg-destructive hover:bg-destructive/90 text-primary-foreground font-semibold"
        >
          Try Again
        </Button>
      ),
    }
  }

  const isLoading = joinCampaignStatus === 'pending' || joinCampaignStatus === 'success'
  if (isLoading) {
    return {
      title: 'Joining Campaign…',
      description: "You're being added to the campaign…",
      statusVariant: 'loading',
      titleColor: 'text-foreground',
      children: <LoadingInvitationState />,
    }
  }

  return {
    title: "You've Been Invited!",
    description: (
      <>
        {campaign.dmUserProfile.name} has invited you to join <strong>{campaign.name}</strong>
      </>
    ),
    statusVariant: 'warning',
    titleColor: 'text-foreground',
    children: (
      <div className="flex flex-col gap-6">
        <CampaignInvitationSummary campaign={campaign} />
        <Button
          onClick={onJoinCampaign}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span>Join Campaign</span>
        </Button>
      </div>
    ),
  }
}

export function JoinCampaignPage() {
  const navigate = useNavigate()
  const { dmUsername: rawDmUsername, campaignSlug: rawCampaignSlug } = useParams({
    from: '/_app/join/$dmUsername/$campaignSlug/',
  })
  const dmUsername = parseUsername(rawDmUsername)
  const campaignSlug = parseCampaignSlug(rawCampaignSlug)
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthLoading && !isAuthenticated) {
      sessionStorage.setItem('joinCampaignRedirectUrl', window.location.href)
    }
  }, [isAuthLoading, isAuthenticated])

  const {
    data: campaign,
    error: campaignError,
    refetch: refetchCampaign,
    status: campaignQueryStatus,
  } = useJoinCampaignQuery(dmUsername, campaignSlug)

  const campaignMember = campaign?.myMembership
  const campaignLookupState = resolveCampaignLookupState({
    data: campaign,
    error: campaignError,
    refetch: refetchCampaign,
    status: campaignQueryStatus,
  })

  const joinCampaign = useJoinCampaignMutation()

  const handleJoinCampaign = async () => {
    if (!campaign || !dmUsername || !campaignSlug) return

    try {
      await joinCampaign.mutateAsync({
        slug: campaignSlug,
        dmUsername,
      })
    } catch {
      // Error UI rendered via joinCampaign.status === 'error'
    }
  }

  const goToHome = () => {
    void navigate({ to: '/campaigns' })
  }

  const goToCampaignHome = () => {
    if (!dmUsername || !campaignSlug) return
    void navigate({
      to: '/campaigns/$dmUsername/$campaignSlug',
      params: { dmUsername, campaignSlug },
    })
  }

  if (!dmUsername || !campaignSlug) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-card">
          <CardHeader className="text-center pb-6 pt-8">
            <StatusIcon variant="error" />
            <CardTitle className="text-2xl font-bold text-destructive mb-3 tracking-tight">
              Invalid Invitation Link
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base leading-relaxed px-2">
              This campaign invite URL is malformed.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8 min-h-[120px] flex flex-col justify-center">
            <Button
              onClick={goToHome}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Browse Campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cardContent = buildJoinCampaignCardContent({
    campaignLookupState,
    campaignMember,
    isAuthLoading,
    isAuthenticated,
    joinCampaignStatus: joinCampaign.status,
    onGoCampaignHome: goToCampaignHome,
    onGoHome: goToHome,
    onJoinCampaign: handleJoinCampaign,
    onShowSignIn: () => setShowSignIn(true),
  })

  if (!isAuthenticated && showSignIn) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
              Sign in to join{' '}
              <span className="text-primary">{campaign?.name || 'this campaign'}</span>
            </h1>
          </div>
          <div className="flex justify-center">
            <SignInForm redirectTo={typeof window !== 'undefined' ? window.location.href : ''} />
          </div>
          <div className="text-center mt-4">
            <Button
              onClick={() => setShowSignIn(false)}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back to invitation
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!cardContent) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col">
      {isAuthenticated && <Header />}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-card">
          <CardHeader className="text-center pb-6 pt-8">
            <StatusIcon variant={cardContent.statusVariant} />
            <CardTitle
              className={`text-2xl font-bold ${cardContent.titleColor} mb-3 tracking-tight`}
            >
              {cardContent.title}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base leading-relaxed px-2">
              {cardContent.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-8 px-8 min-h-[120px] flex flex-col justify-center">
            {cardContent.children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
