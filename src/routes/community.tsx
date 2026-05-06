import { createFileRoute } from '@tanstack/react-router'
import { Github, MessageCircle, MessageSquare } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicPageHead, publicSite } from '~/features/landing/content/public-site'
import { buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

const communityLinks = [
  {
    title: 'Discord',
    body: 'Chat with other users, ask informal questions, share feedback, and follow product updates.',
    action: 'Join Discord',
    href: publicSite.community.discordUrl,
    icon: MessageCircle,
    disabled: false,
  },
  {
    title: 'Reddit',
    body: 'A public space for broader discussion, showcases, and campaign ideas.',
    action: 'Coming soon',
    href: '',
    icon: MessageSquare,
    disabled: true,
  },
  {
    title: 'GitHub',
    body: 'View the project, follow development, report bugs, and request technical changes.',
    action: 'View GitHub',
    href: publicSite.community.githubUrl,
    icon: Github,
    disabled: false,
  },
]

function CommunityRouteComponent() {
  return (
    <PublicPageLayout>
      <main className="py-20">
        <LandingContainer>
          <PublicPageHeader title="Community" />

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {communityLinks.map((item) => {
              const Icon = item.icon

              return (
                <section
                  key={item.title}
                  className={cn(
                    'flex min-h-64 flex-col rounded-lg border border-border/30 bg-secondary/20 p-6',
                    item.disabled && 'opacity-75',
                  )}
                >
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-6 text-lg font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  {item.disabled ? (
                    <span className={buttonVariants({ variant: 'outline', className: 'mt-6' })}>
                      {item.action}
                    </span>
                  ) : (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ className: 'mt-6' })}
                    >
                      {item.action}
                    </a>
                  )}
                </section>
              )
            })}
          </div>
        </LandingContainer>
      </main>
    </PublicPageLayout>
  )
}

export const Route = createFileRoute('/community')({
  head: () =>
    publicPageHead({
      title: 'Community',
      description: "Community channels for The Wizard's Archive, including Discord and GitHub.",
    }),
  component: CommunityRouteComponent,
})
