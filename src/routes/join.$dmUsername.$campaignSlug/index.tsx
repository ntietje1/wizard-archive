import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useUser, SignIn } from '@clerk/tanstack-react-start'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/shadcn/ui/card'
import { Button } from '~/components/shadcn/ui/button'
import { Shield, Users, Loader2 } from '~/lib/icons'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
} from 'convex/campaigns/types'
import { useState } from 'react'
import { Header } from '~/components/Header'

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
      bg: 'bg-blue-100',
      icon: 'text-blue-600',
      ring: 'ring-blue-200/50',
    },
    success: {
      bg: 'bg-emerald-100',
      icon: 'text-emerald-600',
      ring: 'ring-emerald-200/50',
    },
    error: {
      bg: 'bg-red-100',
      icon: 'text-red-600',
      ring: 'ring-red-200/50',
    },
    warning: {
      bg: 'bg-amber-100',
      icon: 'text-amber-600',
      ring: 'ring-amber-200/50',
    },
  }

  const config = configs[variant]

  return (
    <div
      className={`relative p-4 ${config.bg} ${config.ring} ring-2 rounded-2xl w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-lg hover:scale-102`}
    >
      <Shield className={`h-10 w-10 ${config.icon} drop-shadow-sm`} />
      <div className="absolute inset-0 bg-white/20 rounded-2xl" />
    </div>
  )
}

function RouteComponent() {
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = Route.useParams()
  const { user, isLoaded: isUserLoaded } = useUser()
  const [showSignIn, setShowSignIn] = useState(false)

  const campaignQuery = useQuery(
    convexQuery(api.campaigns.queries.getPublicCampaignBySlug, {
      dmUsername,
      slug: campaignSlug,
    }),
  )

  const { campaign, campaignMember } = campaignQuery.data ?? {}

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
    if (!isUserLoaded) {
      return {
        title: 'Loading User...',
        description: 'Please wait a moment.',
        statusVariant: 'loading' as const,
        titleColor: 'text-slate-900',
        children: (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500 animate-pulse">Loading...</p>
          </div>
        ),
      }
    }

    if (!user) {
      if (showSignIn) {
        return null // don't show anything if we're showing sign-in
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
        titleColor: 'text-slate-900',
        children: campaign ? (
          <div className="space-y-6">
            <div className="relative p-6 bg-slate-50 rounded-2xl border border-slate-200/50 shadow-sm">
              <div className="absolute top-4 right-4 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <h3 className="font-bold text-slate-900 mb-3 text-lg text-left">
                {campaign.name}
              </h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed text-left">
                {campaign.description || 'No description provided'}
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="p-1.5 bg-slate-200 rounded-full">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span>
                  Campaign by{' '}
                  <span className="font-medium text-slate-700">
                    @{campaign.dmUserProfile.username}
                  </span>
                </span>
              </div>
            </div>
            <Button
              onClick={() => setShowSignIn(true)}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg"
            >
              Sign In to Join
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowSignIn(true)}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg"
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
        titleColor: 'text-slate-900',
        children: (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500 animate-pulse">Loading...</p>
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
        titleColor: 'text-red-800',
        children: (
          <Button
            onClick={goToHome}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg"
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
        titleColor: 'text-slate-900',
        children: (
          <div className="flex flex-col gap-3">
            <Button
              onClick={goToCampaignHome}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg"
            >
              Go to Campaign
            </Button>
            <Button
              onClick={goToPlayers}
              variant="outline"
              className="w-full h-12 border-2 border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl shadow-sm"
            >
              Manage Players
            </Button>
          </div>
        ),
      }
    }

    // Request sent states
    if (campaignMember?.role === CAMPAIGN_MEMBER_ROLE.Player) {
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
            titleColor: 'text-slate-900',
            children: (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-800 font-medium">
                    This page will automatically update when you gain access.
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
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
            titleColor: 'text-slate-900',
            children: (
              <Button
                onClick={goToCampaignHome}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg"
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
            titleColor: 'text-red-800',
            children: (
              <Button
                onClick={goToHome}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg"
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
            titleColor: 'text-red-800',
            children: (
              <Button
                onClick={goToHome}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg"
              >
                Exit
              </Button>
            ),
          }
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
          titleColor: 'text-red-800',
          children: (
            <Button
              onClick={handleJoinCampaign}
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg"
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
          titleColor: 'text-slate-900',
          children: (
            <div className="flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500 animate-pulse">Loading...</p>
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
          titleColor: 'text-slate-900',
          children: (
            <div className="space-y-6">
              <div className="relative p-6 bg-slate-50 rounded-2xl border border-slate-200/50 shadow-sm">
                <div className="absolute top-4 right-4 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <h3 className="font-bold text-slate-900 mb-3 text-lg text-left">
                  {campaign.name}
                </h3>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed text-left">
                  {campaign.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <div className="p-1.5 bg-slate-200 rounded-full">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <span>
                    Campaign by{' '}
                    <span className="font-medium text-slate-700">
                      @{campaign.dmUserProfile.username}
                    </span>
                  </span>
                </div>
              </div>
              <Button
                onClick={handleJoinCampaign}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
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

  if (!user && showSignIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">
              Sign in to join{' '}
              <span className="text-purple-600">
                {campaign?.name || 'this campaign'}
              </span>
            </h1>
          </div>
          <div className="flex justify-center">
            <SignIn routing="hash" forceRedirectUrl={window.location.href} />
          </div>
          <div className="text-center mt-4">
            <Button
              onClick={() => setShowSignIn(false)}
              variant="ghost"
              className="text-slate-600 hover:text-slate-800"
            >
              ← Back to invitation
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // If cardContent is null, don't render the card (this shouldn't happen in normal flow)
  if (!cardContent) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {user && <Header />}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6 pt-8">
            <StatusIcon variant={cardContent.statusVariant} />
            <CardTitle
              className={`text-2xl font-bold ${cardContent.titleColor} mb-3 tracking-tight`}
            >
              {cardContent.title}
            </CardTitle>
            <CardDescription className="text-slate-600 text-base leading-relaxed px-2">
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
