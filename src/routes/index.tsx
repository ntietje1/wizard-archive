import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '~/components/shadcn/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-foreground">
          Welcome to {"The Wizard's Archive"}
        </h1>
        <p className="text-xl text-muted-foreground">
          Your ultimate companion for building and sharing TTRPG adventures
        </p>
        <SignedOut>
          <Link to="/sign-in">
            <Button size="lg" className="text-lg px-8 min-w-32">
              Get Started
            </Button>
          </Link>
        </SignedOut>
        <SignedIn>
          <Link to="/campaigns">
            <Button size="lg" className="text-lg px-8 min-w-32">
              Continue
            </Button>
          </Link>
        </SignedIn>
      </div>
    </div>
  )
}
