import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SignIn, useUser } from '@clerk/tanstack-react-start'
import { Header } from '~/components/Header'
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
  }, [user])
}

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error('Not authenticated')
    }
  },
  errorComponent: ({ error }) => {
    if (error.message === 'Not authenticated') {
      return (
        <div className="flex items-center justify-center p-12">
          <SignIn routing="hash" forceRedirectUrl={window.location.href} />
        </div>
      )
    }

    throw error
  },
  component: () => {
    useEnsureProfile()
    return (
      <div className="flex-1 flex flex-col">
        <Header />
        <Outlet />
      </div>
    )
  },
})
