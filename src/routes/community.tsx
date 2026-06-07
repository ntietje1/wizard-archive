import { createFileRoute } from '@tanstack/react-router'
import { Github, MessageCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { publicPageHead, publicSite } from '~/features/landing/content/public-site'
import { buttonVariants } from '~/features/shadcn/components/button'

type CommunityChannelId = (typeof publicSite.community.channels)[number]['id']

const communityChannelIcons = {
  discord: MessageCircle,
  github: Github,
} satisfies Record<CommunityChannelId, LucideIcon>

const communityChannels = publicSite.community.channels.filter((item) => item.href.length > 0)
const communityChannelLabelList = new Intl.ListFormat('en', {
  style: 'long',
  type: 'conjunction',
}).format(communityChannels.map((item) => item.label))

function CommunityRouteComponent() {
  return (
    <PublicPageLayout>
      <main className="py-20">
        <LandingContainer>
          <PublicPageHeader title="Community" />

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
            {communityChannels.map((item) => {
              const Icon = communityChannelIcons[item.id]

              return (
                <section
                  key={item.title}
                  className="flex min-h-64 flex-col rounded-lg border border-border/30 bg-secondary/20 p-6"
                >
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-6 text-lg font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ className: 'mt-6' })}
                  >
                    {item.action}
                  </a>
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
      description: `Community channels for The Wizard's Archive, including ${communityChannelLabelList}.`,
    }),
  component: CommunityRouteComponent,
})
