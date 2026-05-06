import { createFileRoute } from '@tanstack/react-router'
import { PolicyPage, PolicySection } from '~/features/landing/components/policy-page'
import { emailHref, publicPageHead, publicSite } from '~/features/landing/content/public-site'

function TermsRouteComponent() {
  return (
    <PolicyPage
      title="Terms of Service"
      description={`These terms are between you and ${publicSite.legalName}, operator of ${publicSite.brandName}.`}
    >
      <PolicySection title="Service provider">
        <p>
          {publicSite.legalName} operates {publicSite.brandName}. References to "we," "us," and
          "our" mean {publicSite.legalName}.
        </p>
      </PolicySection>

      <PolicySection title="Account eligibility">
        <p>
          You must be at least {publicSite.minimumAge} years old to create an account. You are
          responsible for your account credentials and for activity that happens through your
          account.
        </p>
      </PolicySection>

      <PolicySection title="Your content">
        <p>
          {publicSite.trust.contentOwnership} You grant us permission to host, process, transmit,
          back up, and display that content as needed to operate the service.
        </p>
        <p>
          Content becomes visible to other users only through access you choose to grant.{' '}
          {publicSite.trust.exportAvailability} {publicSite.trust.noAiTraining}
        </p>
      </PolicySection>

      <PolicySection title="Acceptable use">
        <p>
          Do not use the service to break the law, abuse other users, attempt to bypass security,
          overload the service, upload malware, infringe others' rights, or interfere with another
          user's account or content. You are responsible for having the rights needed for content
          you upload or share through the service.
        </p>
      </PolicySection>

      <PolicySection title="Trials, subscriptions, and billing">
        <p>
          {publicSite.trial.disclosure} Paid DM features require an active subscription after the
          trial. Pricing and billing details are described on the Pricing and Billing pages.
        </p>
        <p>
          Once paid subscriptions are enabled, subscriptions renew until canceled. You will be able
          to cancel from account settings before the next billing period.
        </p>
      </PolicySection>

      <PolicySection title="Operational telemetry">
        <p>
          We may use error monitoring, security logging, and product analytics to operate, secure,
          debug, and improve the service. Non-essential analytics is controlled through privacy
          preferences. {publicSite.trust.analyticsExclusion} Additional detail is provided in the
          Privacy Policy.
        </p>
      </PolicySection>

      <PolicySection title="Termination">
        <p>
          You may stop using the service at any time. We may suspend or terminate access if an
          account violates these terms, creates risk for the service, or is used in a way that harms
          other users.
        </p>
      </PolicySection>

      <PolicySection title="Disclaimers and liability">
        <p>
          The service is provided as available. We work to keep it reliable, but we do not guarantee
          uninterrupted access or that every issue will be fixed immediately. To the fullest extent
          allowed by law, liability is limited to the amount you paid for the service in the months
          before the claim.
        </p>
      </PolicySection>

      <PolicySection title="Legal notices">
        <p>
          Send legal notices for {publicSite.legalName} to{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.legalEmail)}
          >
            {publicSite.legalEmail}
          </a>
          . Send product and billing questions to{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.supportEmail)}
          >
            {publicSite.supportEmail}
          </a>
          .
        </p>
      </PolicySection>
    </PolicyPage>
  )
}

export const Route = createFileRoute('/terms')({
  head: () =>
    publicPageHead({
      title: 'Terms of Service',
      description:
        "Terms of Service for The Wizard's Archive accounts, private campaign content, subscriptions, and acceptable use.",
    }),
  component: TermsRouteComponent,
})
