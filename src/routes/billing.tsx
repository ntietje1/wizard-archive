import { createFileRoute } from '@tanstack/react-router'
import { PolicyPage, PolicySection } from '~/features/landing/components/policy-page'
import { emailHref, publicPageHead, publicSite } from '~/features/landing/content/public-site'

function BillingRouteComponent() {
  return (
    <PolicyPage
      title="Billing, Refund, and Cancellation Policy"
      description={`Plain-English billing terms from ${publicSite.legalName} for the free trial, recurring subscriptions, cancellations, and refund requests.`}
    >
      <PolicySection title="Free trial">
        <p>
          {publicSite.trial.disclosure} The trial lets you evaluate the product before choosing a
          paid plan.
        </p>
      </PolicySection>

      <PolicySection title="Paid plan">
        <p>
          The Pro plan is {publicSite.pricing.monthly} per month when billed monthly, or{' '}
          {publicSite.pricing.annualMonthly} per month when billed annually at{' '}
          {publicSite.pricing.annualTotal}. {publicSite.pricing.playerAccess}
        </p>
        <p>
          Prices are listed in U.S. dollars and do not include taxes unless taxes are shown at
          checkout.
        </p>
      </PolicySection>

      <PolicySection title="Renewals and cancellation">
        <p>
          Once paid subscriptions are enabled, subscriptions renew automatically until canceled.
          {` ${publicSite.billing.cancellation}`} Cancellation stops future renewal charges but does
          not automatically refund past charges.
        </p>
        <p>
          The free trial does not require a credit card, so you will not be charged at the end of
          the trial unless you choose a paid plan and add payment information.
        </p>
      </PolicySection>

      <PolicySection title="Account content">
        <p>
          {publicSite.trust.contentOwnership} {publicSite.trust.exportAvailability}
        </p>
      </PolicySection>

      <PolicySection title="Refunds">
        <p>
          {publicSite.billing.refunds} Email{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.supportEmail)}
          >
            {publicSite.supportEmail}
          </a>{' '}
          with the account email, charge date, and a short description of the issue.
        </p>
      </PolicySection>

      <PolicySection title="Failed payments">
        <p>
          When payments are enabled, failed payments may lead to retry attempts, billing notices,
          temporary account limitations, or subscription cancellation if the issue is not resolved.
        </p>
      </PolicySection>

      <PolicySection title="Billing support">
        <p>
          For billing questions, cancellation help, or suspected billing errors, contact{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.supportEmail)}
          >
            {publicSite.supportEmail}
          </a>
          .
        </p>
        <p>
          Billing terms are shown on the Pricing page and during checkout. If anything looks
          inconsistent, contact support before purchasing.
        </p>
      </PolicySection>
    </PolicyPage>
  )
}

export const Route = createFileRoute('/billing')({
  head: () =>
    publicPageHead({
      title: 'Billing Policy',
      description:
        "Billing, refund, cancellation, trial, and subscription policy for The Wizard's Archive.",
    }),
  component: BillingRouteComponent,
})
