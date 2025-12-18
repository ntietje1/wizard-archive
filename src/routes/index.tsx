import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '~/components/shadcn/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center space-y-8">
        <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
          Welcome to {"The Wizard's Archive"}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
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
