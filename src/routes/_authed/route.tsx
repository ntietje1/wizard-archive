import { Outlet, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { SignInForm } from '~/components/auth/SignInForm'
import { Loader2 } from '~/lib/icons'

const useEnsureProfile = () => {
  const { isAuthenticated } = useConvexAuth()
  const ensureProfile = useMutation({
    mutationFn: useConvexMutation(api.users.mutations.ensureUserProfile),
  })

  useEffect(() => {
    if (!isAuthenticated) return
    ensureProfile.mutate(undefined, {
      onError: (_) => {
        toast.error(
          'An error occured while loading your account. Please try refreshing the page.',
        )
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])
}

function AuthedRouteComponent() {
  useEnsureProfile()
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    const forceRedirectUrl =
      typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/campaigns'
    return (
      <div className="flex items-center justify-center p-24">
        <SignInForm redirectTo={forceRedirectUrl} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Outlet />
    </div>
  )
}

export const Route = createFileRoute('/_authed')({
  component: AuthedRouteComponent,
})
