import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '~/features/shadcn/components/button'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Welcome to {"The Wizard's Archive"}
        </h1>
        <p className="text-xl text-muted-foreground">
          Your ultimate companion for building and sharing TTRPG adventures
        </p>
        <Link to="/sign-in">
          <Button size="lg" className="text-lg px-8 min-w-32">
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  )
}
