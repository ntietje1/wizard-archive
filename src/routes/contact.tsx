import { createFileRoute } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { emailHref, publicPageHead, publicSite } from '~/features/landing/content/public-site'

const contactCards = [
  {
    title: 'Support and billing',
    body: 'Use this for account access, product help, subscriptions, refunds, cancellations, and billing errors.',
    email: publicSite.supportEmail,
  },
  {
    title: 'Privacy requests',
    body: 'Use this for questions about personal information, account deletion, or privacy rights.',
    email: publicSite.privacyEmail,
  },
  {
    title: 'Legal notices',
    body: 'Use this for legal notices and formal policy questions.',
    email: publicSite.legalEmail,
  },
  {
    title: 'Security concerns',
    body: 'Use this for suspected account, privacy, or security issues. Include enough detail to help investigate.',
    email: publicSite.supportEmail,
  },
]

function ContactRouteComponent() {
  return (
    <PublicPageLayout>
      <main className="py-20">
        <LandingContainer>
          <PublicPageHeader
            title="Contact"
            description={
              <>
                Email is the primary support channel. Messages are reviewed by{' '}
                {publicSite.legalName}; response times may vary.
              </>
            }
          />

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
            {contactCards.map((card) => (
              <div
                key={card.email}
                className="rounded-lg border border-border/30 bg-secondary/20 p-6"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/12 text-primary">
                  <Mail className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-foreground">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.body}</p>
                <a
                  href={emailHref(card.email)}
                  className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {card.email}
                </a>
              </div>
            ))}
          </div>
        </LandingContainer>
      </main>
    </PublicPageLayout>
  )
}

export const Route = createFileRoute('/contact')({
  head: () =>
    publicPageHead({
      title: 'Contact',
      description: "Support, privacy, and legal contact information for The Wizard's Archive.",
    }),
  component: ContactRouteComponent,
})
