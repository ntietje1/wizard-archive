import { Outlet, createFileRoute } from '@tanstack/react-router'
import {
  SignIn,
  SignedIn,
  SignedOut,
  useUser,
} from '@clerk/tanstack-react-start'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'

const useEnsureProfile = () => {
  const { user } = useUser()
  const ensureProfile = useMutation({
    mutationFn: useConvexMutation(api.users.mutations.ensureUserProfile),
  })

  useEffect(() => {
    if (!user) return
    ensureProfile.mutate(undefined, {
      onError: (_) => {
        toast.error(
          'An error occured while loading your account. Please try refreshing the page.',
        )
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])
}

function AuthedRouteComponent() {
  useEnsureProfile()
  const forceRedirectUrl =
    typeof window !== 'undefined' ? window.location.href : '/'
  return (
    <div className="flex flex-col h-screen">
      <SignedOut>
        <div className="flex items-center justify-center p-24">
          <SignIn routing="hash" forceRedirectUrl={forceRedirectUrl} />
        </div>
      </SignedOut>
      <SignedIn>
        <Outlet />
      </SignedIn>
    </div>
  )
}

export const Route = createFileRoute('/_authed')({
  // beforeLoad: ({ context }) => {
  //   if (!context.userId) {
  //     throw new Error('Not authenticated')
  //   }
  // },
  // errorComponent: ({ error }) => {
  //   return <ErrorPage error={error.message} />
  // },
  component: AuthedRouteComponent,
})
