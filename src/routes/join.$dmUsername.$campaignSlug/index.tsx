import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useConvexAuth } from 'convex/react'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
} from 'convex/campaigns/types'
import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/shadcn/ui/card'
import { Button } from '~/components/shadcn/ui/button'
import { Loader2, Shield, Users } from '~/lib/icons'
import { Header } from '~/components/Header'
import { SignInForm } from '~/components/auth/SignInForm'

export const Route = createFileRoute('/join/$dmUsername/$campaignSlug/')({
  component: RouteComponent,
})

type StatusIconVariant = 'loading' | 'success' | 'error' | 'warning'

interface StatusIconProps {
  variant: StatusIconVariant
}

function StatusIcon({ variant }: StatusIconProps) {
  const configs = {
    loading: {
      bg: 'bg-accent',
      icon: 'text-primary',
      ring: 'ring-ring/50',
    },
    success: {
      bg: 'bg-accent',
      icon: 'text-primary',
      ring: 'ring-ring/50',
    },
    error: {
      bg: 'bg-destructive/15',
      icon: 'text-destructive',
      ring: 'ring-destructive/30',
    },
    warning: {
      bg: 'bg-accent',
      icon: 'text-primary',
      ring: 'ring-ring/50',
    },
  }

  const config = configs[variant]

  return (
    <div
      className={`relative p-4 ${config.bg} ${config.ring} ring-2 rounded-2xl w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg hover:scale-102`}
    >
      <Shield className={`h-10 w-10 ${config.icon} drop-shadow-sm`} />
      <div className="absolute inset-0 bg-card/20 rounded-2xl" />
    </div>
  )
}

function RouteComponent() {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = Route.useParams()
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthLoading && !isAuthenticated) {
      sessionStorage.setItem('joinCampaignRedirectUrl', window.location.href)
    }
  }, [isAuthLoading, isAuthenticated])

  const campaignQuery = useQuery(
    convexQuery(api.campaigns.queries.getCampaignBySlug, {
      dmUsername,
      slug: campaignSlug,
    }),
  )

  const campaign = campaignQuery.data
  const campaignMember = campaign?.myMembership

  const joinCampaign = useMutation({
    mutationFn: useConvexMutation(api.campaigns.mutations.joinCampaign),
  })

  const handleJoinCampaign = async () => {
    if (!campaign) return

    await joinCampaign.mutateAsync({
      slug: campaignSlug,
      dmUsername,
    })
  }

  const goToHome = () => {
    navigate({ to: '/campaigns' })
  }

  const goToCampaignHome = () => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug',
      params: { dmUsername, campaignSlug },
    })
  }

  const goToPlayers = () => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/players',
      params: { dmUsername, campaignSlug },
    })
  }

  const getCardContent = () => {
    if (isAuthLoading) {
      return {
        title: 'Loading User...',
        description: 'Please wait a moment.',
        statusVariant: 'loading' as const,
        titleColor: 'text-foreground',
        children: (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading...
            </p>
          </div>
        ),
      }
    }

    if (!isAuthenticated) {
      if (showSignIn) {
        return null
      }

      return {
        title: "You've Been Invited!",
        description: campaign ? (
          <>
            {campaign.dmUserProfile.name} has invited you to join{' '}
            <strong>{campaign.name}</strong>
          </>
        ) : (
          "You've been invited to join a campaign."
        ),
        statusVariant: 'warning' as const,
        titleColor: 'text-foreground',
        children: campaign ? (
          <div className="space-y-6">
            <div className="relative p-6 bg-muted rounded-2xl border border-border shadow-sm">
              <div className="absolute top-4 right-4 w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
              <h3 className="font-bold text-foreground mb-3 text-lg text-left">
                {campaign.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed text-left">
                {campaign.description || 'No description provided'}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="p-1.5 bg-secondary rounded-full">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span>
                  Campaign by{' '}
                  <span className="font-medium text-foreground">
                    @{campaign.dmUserProfile.username}
                  </span>
                </span>
              </div>
            </div>
            <Button
              onClick={() => setShowSignIn(true)}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg"
            >
              Sign In to Join
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowSignIn(true)}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg"
          >
            Sign In to Join
          </Button>
        ),
      }
    }

    if (campaignQuery.isLoading) {
      return {
        title: 'Loading Campaign...',
        description: 'Please wait a moment.',
        statusVariant: 'loading' as const,
        titleColor: 'text-foreground',
        children: (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">
              Loading...
            </p>
          </div>
        ),
      }
    }

    if (campaignQuery.isError || !campaignQuery.data || !campaign) {
      return {
        title: 'Campaign Not Found',
        description:
          "The campaign link you're trying to access doesn't exist or has been removed.",
        statusVariant: 'error' as const,
        titleColor: 'text-destructive',
        children: (
          <Button
            onClick={goToHome}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg"
          >
            Browse Campaigns
          </Button>
        ),
      }
    }

    // DM state
    if (campaignMember?.role === CAMPAIGN_MEMBER_ROLE.DM) {
      return {
        title: "You're the DM",
        description: (
          <>
            This is your campaign, <strong>{campaign.name}</strong>. Share the
            link with your players so they can join.
          </>
        ),
        statusVariant: 'warning' as const,
        titleColor: 'text-foreground',
        children: (
          <div className="flex flex-col gap-3">
            <Button
              onClick={goToCampaignHome}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg"
            >
              Go to Campaign
            </Button>
            <Button
              onClick={goToPlayers}
              variant="outline"
              className="w-full h-12 border-2 border-border hover:border-primary/50 bg-card hover:bg-muted text-foreground font-semibold rounded-xl shadow-sm"
            >
              Manage Players
            </Button>
          </div>
        ),
      }
    }

    // Request sent states
    switch (campaignMember?.status) {
      case CAMPAIGN_MEMBER_STATUS.Pending:
        return {
          title: 'Request Sent',
          description: (
            <>
              Your request to join <strong>{campaign.name}</strong> has been
              sent. {"You'll gain access once the DM confirms your request."}
            </>
          ),
          statusVariant: 'warning' as const,
          titleColor: 'text-foreground',
          children: (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-accent rounded-xl border border-primary/30">
                <p className="text-sm text-accent-foreground font-medium">
                  This page will automatically update when you gain access.
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-pulse"></div>
                <span>Waiting for DM approval</span>
              </div>
            </div>
          ),
        }

      case CAMPAIGN_MEMBER_STATUS.Accepted:
        return {
          title: "You're In!",
          description: (
            <>
              You now have access to <strong>{campaign.name}</strong>.
            </>
          ),
          statusVariant: 'success' as const,
          titleColor: 'text-foreground',
          children: (
            <Button
              onClick={goToCampaignHome}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg"
            >
              Go to Campaign
            </Button>
          ),
        }

      case CAMPAIGN_MEMBER_STATUS.Rejected:
        return {
          title: 'Request Rejected',
          description: (
            <>
              Your request to join <strong>{campaign.name}</strong> has been
              rejected.
            </>
          ),
          statusVariant: 'error' as const,
          titleColor: 'text-destructive',
          children: (
            <Button
              onClick={goToHome}
              className="w-full h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-xl shadow-lg"
            >
              Exit
            </Button>
          ),
        }

      case CAMPAIGN_MEMBER_STATUS.Removed:
        return {
          title: "You've Been Removed",
          description: (
            <p>
              {"You've been removed from "}
              <strong>{campaign.name}</strong>
              {'.'}
            </p>
          ),
          statusVariant: 'error' as const,
          titleColor: 'text-destructive',
          children: (
            <Button
              onClick={goToHome}
              className="w-full h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-xl shadow-lg"
            >
              Exit
            </Button>
          ),
        }
    }

    // Not requested yet states
    switch (joinCampaign.status) {
      case 'error':
        return {
          title: 'Failed to Join',
          description:
            'Something went wrong while trying to join. Please try again.',
          statusVariant: 'error' as const,
          titleColor: 'text-destructive',
          children: (
            <Button
              onClick={handleJoinCampaign}
              className="w-full h-12 bg-destructive hover:bg-destructive/90 text-primary-foreground font-semibold rounded-xl shadow-lg"
            >
              Try Again
            </Button>
          ),
        }

      case 'success':
        return {
          title: 'Joining Campaign...',
          description: "You're being added to the campaign...",
          statusVariant: 'loading' as const,
          titleColor: 'text-foreground',
          children: (
            <div className="flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">
                Loading...
              </p>
            </div>
          ),
        }

      case 'pending':
      case 'idle':
      default: {
        const isLoading = joinCampaign.status === 'pending'
        return {
          title: "You've Been Invited!",
          description: (
            <>
              {campaign.dmUserProfile.name} has invited you to join{' '}
              <strong>{campaign.name}</strong>
            </>
          ),
          statusVariant: 'warning' as const,
          titleColor: 'text-foreground',
          children: (
            <div className="space-y-6">
              <div className="relative p-6 bg-muted rounded-2xl border border-border shadow-sm">
                <div className="absolute top-4 right-4 w-2 h-2 bg-primary/60 rounded-full animate-pulse" />
                <h3 className="font-bold text-foreground mb-3 text-lg text-left">
                  {campaign.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed text-left">
                  {campaign.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="p-1.5 bg-secondary rounded-full">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <span>
                    Campaign by{' '}
                    <span className="font-medium text-foreground">
                      @{campaign.dmUserProfile.username}
                    </span>
                  </span>
                </div>
              </div>
              <Button
                onClick={handleJoinCampaign}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin mr-3" />
                    <span>Joining Campaign...</span>
                  </div>
                ) : (
                  <span>Join Campaign</span>
                )}
              </Button>
            </div>
          ),
        }
      }
    }
  }

  const cardContent = getCardContent()

  if (!isAuthenticated && showSignIn) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
              Sign in to join{' '}
              <span className="text-primary">
                {campaign?.name || 'this campaign'}
              </span>
            </h1>
          </div>
          <div className="flex justify-center">
            <SignInForm redirectTo={window.location.href} />
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
        <Card className="w-full max-w-lg shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
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
