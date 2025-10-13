import { createFileRoute, Outlet } from '@tanstack/react-router'
import {
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  useUser,
} from '@clerk/tanstack-react-start'
import { Header } from '~/components/Header'
import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { Authenticated } from 'convex/react'
import ErrorPage from '~/components/error/error-page'

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
  }, [user])
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
  component: () => {
    useEnsureProfile()
    const forceRedirectUrl =
      typeof window !== 'undefined' ? window.location.href : '/'
    return (
      <div className="flex flex-col h-screen">
        <Header />
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
  },
})
