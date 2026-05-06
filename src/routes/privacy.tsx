import { createFileRoute } from '@tanstack/react-router'
import { PolicyPage, PolicySection } from '~/features/landing/components/policy-page'
import { emailHref, publicPageHead, publicSite } from '~/features/landing/content/public-site'

function PrivacyRouteComponent() {
  return (
    <PolicyPage
      title="Privacy Policy"
      description={`This policy explains how ${publicSite.legalName}, operator of ${publicSite.brandName}, handles personal information.`}
    >
      <PolicySection title="Information we collect">
        <p>
          {publicSite.legalName} operates {publicSite.brandName} and is responsible for the personal
          information described in this policy.
        </p>
        <p>
          We collect information you provide when you create an account, such as your email address,
          password credentials handled through our authentication provider, display name, and
          profile settings.
        </p>
        <p>
          We store the private content you create or upload, sharing settings, and activity needed
          to operate the product. {publicSite.trust.contentOwnership}
        </p>
        <p>
          Payment details are processed by Stripe when subscriptions are enabled. We do not store
          full card numbers on our servers.
        </p>
        <p>
          We collect limited product usage and diagnostic information through{' '}
          {publicSite.analyticsVendors.join(', ')} and{' '}
          {publicSite.errorMonitoringVendors.join(', ')}. This may include pages viewed, features
          used, device/browser details, performance information, errors, and technical request
          information needed to operate and improve the service.
        </p>
      </PolicySection>

      <PolicySection title="How we use information">
        <p>
          We use information to provide the app, authenticate users, sync campaign content, manage
          sharing and permissions, send account emails, respond to support requests, secure the
          service, diagnose errors, understand product usage, improve the product, and operate
          billing when payments are enabled.
        </p>
        <p>
          {publicSite.trust.noDataSelling} {publicSite.trust.noAdTracking}{' '}
          {publicSite.trust.privateByDefault} {publicSite.trust.analyticsExclusion}{' '}
          {publicSite.trust.noAiTraining}
        </p>
      </PolicySection>

      <PolicySection title="Cookies and tracking">
        <p>
          Essential cookies and similar storage may be used for authentication, sessions, security,
          and user preferences. We also use non-essential analytics cookies or similar storage for{' '}
          {publicSite.analyticsVendors.join(', ')} after consent.
        </p>
        <p>
          {publicSite.trust.noAdTracking} You can accept or reject non-essential analytics through
          privacy preferences.
        </p>
      </PolicySection>

      <PolicySection title="Error monitoring and analytics">
        <p>
          {publicSite.errorMonitoringVendors.join(', ')} helps us identify crashes, frontend errors,
          and reliability issues. {publicSite.analyticsVendors.join(', ')} helps us understand
          product usage and improve the service.
        </p>
        <p>
          These tools are configured to limit sensitive data collection. They are not used to
          collect private campaign text, uploaded files, payment card numbers, passwords,
          authentication tokens, or invite secrets.
        </p>
      </PolicySection>

      <PolicySection title="Vendors">
        <p>
          We use service providers to run the product, including{' '}
          {publicSite.essentialVendors.join(', ')}, {publicSite.analyticsVendors.join(', ')}, and{' '}
          {publicSite.errorMonitoringVendors.join(', ')}. These providers may process information
          only as needed to provide hosting, database, authentication, email, storage, security,
          payment, analytics, and error-monitoring services.
        </p>
      </PolicySection>

      <PolicySection title="Your choices and privacy rights">
        <p>
          You can request access, correction, deletion, or export help for account information by
          emailing{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.privacyEmail)}
          >
            {publicSite.privacyEmail}
          </a>
          . Some information may be retained where needed for security, legal compliance, dispute
          resolution, backups, or billing records.
        </p>
        <p>
          {publicSite.trust.noDataSelling} We also do not share personal information for
          cross-context behavioral advertising.
        </p>
        <p>{publicSite.trust.exportAvailability}</p>
      </PolicySection>

      <PolicySection title="Retention and deletion">
        <p>
          We keep account and campaign information while your account is active or as needed to
          provide the service, comply with legal obligations, resolve disputes, prevent abuse, and
          maintain backups. You can request account deletion or privacy help by emailing{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.privacyEmail)}
          >
            {publicSite.privacyEmail}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Children">
        <p>
          {publicSite.brandName} is not intended for children under {publicSite.minimumAge}. If you
          believe a child under {publicSite.minimumAge} has provided personal information, contact
          us at{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.privacyEmail)}
          >
            {publicSite.privacyEmail}
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          For privacy questions, email{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.privacyEmail)}
          >
            {publicSite.privacyEmail}
          </a>
          . For general support, email{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={emailHref(publicSite.supportEmail)}
          >
            {publicSite.supportEmail}
          </a>
          .
        </p>
        <p>
          For a practical summary of the product's privacy and security posture, see{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={publicSite.routes.security}
          >
            Privacy & Security
          </a>
          .
        </p>
      </PolicySection>
    </PolicyPage>
  )
}

export const Route = createFileRoute('/privacy')({
  head: () =>
    publicPageHead({
      title: 'Privacy Policy',
      description:
        "Privacy policy for The Wizard's Archive, including account data, campaign content, vendors, analytics, and support contact details.",
    }),
  component: PrivacyRouteComponent,
})
