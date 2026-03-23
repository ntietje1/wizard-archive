import { Link } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { Button } from '~/features/shadcn/components/button'
import { Loader2 } from '~/features/shared/utils/icons'

export function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Welcome to {"The Wizard's Archive"}
        </h1>
        <p className="text-xl text-muted-foreground">
          Your ultimate companion for building and sharing TTRPG adventures
        </p>
        {isLoading ? (
          <Button size="lg" className="text-lg px-8 min-w-32" disabled>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="sr-only">Loading</span>
          </Button>
        ) : isAuthenticated ? (
          <Link to="/campaigns">
            <Button size="lg" className="text-lg px-8 min-w-32">
              Continue
            </Button>
          </Link>
        ) : (
          <Link to="/sign-in">
            <Button size="lg" className="text-lg px-8 min-w-32">
              Get Started
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
