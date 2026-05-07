import { createFileRoute } from '@tanstack/react-router'
import { KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { PolicySection } from '~/features/landing/components/policy-page'
import {
  PublicPageHeader,
  PublicPageLayout,
} from '~/features/landing/components/public-page-layout'
import { emailHref, publicPageHead, publicSite } from '~/features/landing/content/public-site'

const securityPrinciples = [
  {
    title: 'Private by default',
    body: publicSite.trust.privateByDefault,
    icon: Lock,
  },
  {
    title: 'Controlled access',
    body: 'Users only see the campaign content they have been given access to.',
    icon: UserCheck,
  },
  {
    title: 'Operational monitoring',
    body: 'Error monitoring and consent-based analytics help us maintain reliability and improve the product.',
    icon: ShieldCheck,
  },
  {
    title: 'Account protection',
    body: 'Authentication, sessions, and account emails are handled through service providers that support secure account operations.',
    icon: KeyRound,
  },
]

function SecurityRouteComponent() {
  return (
    <PublicPageLayout>
      <main className="py-20">
        <LandingContainer>
          <PublicPageHeader
            title="Privacy & Security"
            description={
              <>
                {publicSite.brandName} is designed around private content, controlled access, and
                practical monitoring that helps keep the product reliable.
              </>
            }
          />

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
            {securityPrinciples.map((principle) => {
              const Icon = principle.icon

              return (
                <section
                  key={principle.title}
                  className="rounded-lg border border-border/30 bg-secondary/20 p-6"
                >
                  <div className="flex size-11 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-6 text-lg font-semibold text-foreground">{principle.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.body}</p>
                </section>
              )
            })}
          </div>

          <article className="mx-auto mt-16 max-w-3xl space-y-10">
            <PolicySection title="Data ownership and privacy">
              <p>
                {publicSite.trust.contentOwnership} {publicSite.trust.exportAvailability}{' '}
                {publicSite.trust.noAiTraining}
              </p>
            </PolicySection>

            <PolicySection title="Access controls">
              <p>
                Access is controlled through user accounts, campaign membership, invites, and
                sharing settings.
              </p>
            </PolicySection>

            <PolicySection title="Infrastructure and payments">
              <p>
                We use service providers for hosting, database, authentication, email, storage,
                security, analytics, error monitoring, and payments. Payment details are handled by
                Stripe when subscriptions are enabled. The app does not store full card numbers.
              </p>
            </PolicySection>

            <PolicySection title="Monitoring and analytics">
              <p>
                We use {publicSite.errorMonitoringVendors.join(', ')} for error monitoring and{' '}
                {publicSite.analyticsVendors.join(', ')} for product analytics. Error monitoring
                helps us diagnose crashes and reliability issues. Product analytics helps us
                understand and improve the service.
              </p>
              <p>{publicSite.trust.analyticsExclusion}</p>
            </PolicySection>

            <PolicySection title="Limits of this summary">
              <p>
                This page is a practical overview, not an enterprise security whitepaper or
                compliance certification. For the controlling legal details, review the Privacy
                Policy and Terms of Service.
              </p>
            </PolicySection>

            <PolicySection title="Cookies and preferences">
              <p>
                Essential cookies and similar storage support login, security, sessions, and app
                preferences. Non-essential analytics storage is controlled through privacy
                preferences.
              </p>
            </PolicySection>

            <PolicySection title="Security contact">
              <p>
                To report a security or privacy concern, email{' '}
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={emailHref(publicSite.supportEmail)}
                >
                  {publicSite.supportEmail}
                </a>
                .
              </p>
            </PolicySection>
          </article>
        </LandingContainer>
      </main>
    </PublicPageLayout>
  )
}

export const Route = createFileRoute('/security')({
  head: () =>
    publicPageHead({
      title: 'Privacy & Security',
      description:
        "Privacy, security, monitoring, and data protection practices for The Wizard's Archive.",
    }),
  component: SecurityRouteComponent,
})
