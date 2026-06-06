import { KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { emailHref, publicSite } from '~/features/landing/content/public-site'

type PublicPageHeadContent = {
  title: string
  description: string
}

type PublicPolicySectionContent = {
  title: string
  content: ReactNode
}

export type PublicPolicyPageContent = {
  title: string
  description: ReactNode
  head: PublicPageHeadContent
  sections: Array<PublicPolicySectionContent>
}

type PublicSecurityPrinciple = {
  title: string
  body: string
  icon: LucideIcon
}

export type PublicSecurityPageContent = {
  title: string
  description: ReactNode
  head: PublicPageHeadContent
  principles: Array<PublicSecurityPrinciple>
  sections: Array<PublicPolicySectionContent>
}

export const publicPolicyPages = {
  billing: {
    title: 'Billing, Refund, and Cancellation Policy',
    description: `Plain-English billing terms from ${publicSite.legalName} for the free trial, recurring subscriptions, cancellations, and refund requests.`,
    head: {
      title: 'Billing Policy',
      description:
        "Billing, refund, cancellation, trial, and subscription policy for The Wizard's Archive.",
    },
    sections: [
      {
        title: 'Free trial',
        content: (
          <p>
            {publicSite.trial.disclosure} The trial lets you evaluate the product before choosing a
            paid plan.
          </p>
        ),
      },
      {
        title: 'Paid plan',
        content: (
          <>
            <p>
              The Pro plan is {publicSite.pricing.monthly} per month when billed monthly, or{' '}
              {publicSite.pricing.annualMonthly} per month when billed annually at{' '}
              {publicSite.pricing.annualTotal}. {publicSite.pricing.playerAccess}
            </p>
            <p>
              Prices are listed in U.S. dollars and do not include taxes unless taxes are shown at
              checkout.
            </p>
          </>
        ),
      },
      {
        title: 'Renewals and cancellation',
        content: (
          <>
            <p>
              Once paid subscriptions are enabled, subscriptions renew automatically until canceled.
              {` ${publicSite.billing.cancellation}`} Cancellation stops future renewal charges but
              does not automatically refund past charges.
            </p>
            <p>
              The free trial does not require a credit card, so you will not be charged at the end
              of the trial unless you choose a paid plan and add payment information.
            </p>
          </>
        ),
      },
      {
        title: 'Account content',
        content: (
          <p>
            {publicSite.trust.contentOwnership} {publicSite.trust.exportAvailability}
          </p>
        ),
      },
      {
        title: 'Refunds',
        content: (
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
        ),
      },
      {
        title: 'Failed payments',
        content: (
          <p>
            When payments are enabled, failed payments may lead to retry attempts, billing notices,
            temporary account limitations, or subscription cancellation if the issue is not
            resolved.
          </p>
        ),
      },
      {
        title: 'Billing support',
        content: (
          <>
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
          </>
        ),
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: `These terms are between you and ${publicSite.legalName}, operator of ${publicSite.brandName}.`,
    head: {
      title: 'Terms of Service',
      description:
        "Terms of Service for The Wizard's Archive accounts, private campaign content, subscriptions, and acceptable use.",
    },
    sections: [
      {
        title: 'Service provider',
        content: (
          <p>
            {publicSite.legalName} operates {publicSite.brandName}. References to "we," "us," and
            "our" mean {publicSite.legalName}.
          </p>
        ),
      },
      {
        title: 'Account eligibility',
        content: (
          <p>
            You must be at least {publicSite.minimumAge} years old to create an account. You are
            responsible for your account credentials and for activity that happens through your
            account.
          </p>
        ),
      },
      {
        title: 'Your content',
        content: (
          <>
            <p>
              {publicSite.trust.contentOwnership} You grant us permission to host, process,
              transmit, back up, and display that content as needed to operate the service.
            </p>
            <p>
              Content becomes visible to other users only through access you choose to grant.{' '}
              {publicSite.trust.exportAvailability} {publicSite.trust.noAiTraining}
            </p>
          </>
        ),
      },
      {
        title: 'Acceptable use',
        content: (
          <p>
            Do not use the service to break the law, abuse other users, attempt to bypass security,
            overload the service, upload malware, infringe others' rights, or interfere with another
            user's account or content. You are responsible for having the rights needed for content
            you upload or share through the service.
          </p>
        ),
      },
      {
        title: 'Trials, subscriptions, and billing',
        content: (
          <>
            <p>
              {publicSite.trial.disclosure} Paid DM features require an active subscription after
              the trial. Pricing and billing details are described on the Pricing and Billing pages.
            </p>
            <p>
              Once paid subscriptions are enabled, subscriptions renew until canceled. You will be
              able to cancel from account settings before the next billing period.
            </p>
          </>
        ),
      },
      {
        title: 'Operational telemetry',
        content: (
          <p>
            We may use security logging and product analytics to operate, secure, debug, and improve
            the service. Non-essential analytics is controlled through privacy preferences.{' '}
            {publicSite.trust.analyticsExclusion} Additional detail is provided in the Privacy
            Policy.
          </p>
        ),
      },
      {
        title: 'Termination',
        content: (
          <p>
            You may stop using the service at any time. We may suspend or terminate access if an
            account violates these terms, creates risk for the service, or is used in a way that
            harms other users.
          </p>
        ),
      },
      {
        title: 'Disclaimers and liability',
        content: (
          <p>
            The service is provided as available. We work to keep it reliable, but we do not
            guarantee uninterrupted access or that every issue will be fixed immediately. To the
            fullest extent allowed by law, liability is limited to the amount you paid for the
            service in the months before the claim.
          </p>
        ),
      },
      {
        title: 'Legal notices',
        content: (
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
        ),
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: `This policy explains how ${publicSite.legalName}, operator of ${publicSite.brandName}, handles personal information.`,
    head: {
      title: 'Privacy Policy',
      description:
        "Privacy policy for The Wizard's Archive, including account data, campaign content, vendors, analytics, and support contact details.",
    },
    sections: [
      {
        title: 'Information we collect',
        content: (
          <>
            <p>
              {publicSite.legalName} operates {publicSite.brandName} and is responsible for the
              personal information described in this policy.
            </p>
            <p>
              We collect information you provide when you create an account, such as your email
              address, password credentials handled through our authentication provider, display
              name, and profile settings.
            </p>
            <p>
              We store the private content you create or upload, sharing settings, and activity
              needed to operate the product. {publicSite.trust.contentOwnership}
            </p>
            <p>
              Payment details are processed by Stripe when subscriptions are enabled. We do not
              store full card numbers on our servers.
            </p>
            <p>
              We collect limited product usage and diagnostic information through{' '}
              {publicSite.analyticsVendors.join(', ')}. This may include pages viewed, features
              used, device/browser details, performance information, errors, and technical request
              information needed to operate and improve the service.
            </p>
          </>
        ),
      },
      {
        title: 'How we use information',
        content: (
          <>
            <p>
              We use information to provide the app, authenticate users, sync campaign content,
              manage sharing and permissions, send account emails, respond to support requests,
              secure the service, diagnose errors, understand product usage, improve the product,
              and operate billing when payments are enabled.
            </p>
            <p>
              {publicSite.trust.noDataSelling} {publicSite.trust.noAdTracking}{' '}
              {publicSite.trust.privateByDefault} {publicSite.trust.analyticsExclusion}{' '}
              {publicSite.trust.noAiTraining}
            </p>
          </>
        ),
      },
      {
        title: 'Cookies and tracking',
        content: (
          <>
            <p>
              Essential cookies and similar storage may be used for authentication, sessions,
              security, and user preferences. We also use non-essential analytics cookies or similar
              storage for {publicSite.analyticsVendors.join(', ')} after consent.
            </p>
            <p>
              {publicSite.trust.noAdTracking} You can accept or reject non-essential analytics
              through privacy preferences.
            </p>
          </>
        ),
      },
      {
        title: 'Analytics and diagnostics',
        content: (
          <>
            <p>
              {publicSite.analyticsVendors.join(', ')} helps us understand product usage and improve
              the service.
            </p>
            <p>
              Analytics and diagnostics are configured to limit sensitive data collection. They are
              not used to collect private campaign text, uploaded files, payment card numbers,
              passwords, authentication tokens, or invite secrets.
            </p>
          </>
        ),
      },
      {
        title: 'Vendors',
        content: (
          <p>
            We use service providers to run the product, including{' '}
            {publicSite.essentialVendors.join(', ')} and {publicSite.analyticsVendors.join(', ')}.
            These providers may process information only as needed to provide hosting, database,
            authentication, email, storage, security, payment, and analytics services.
          </p>
        ),
      },
      {
        title: 'Your choices and privacy rights',
        content: (
          <>
            <p>
              You can request access, correction, deletion, or export help for account information
              by emailing{' '}
              <a
                className="text-primary underline-offset-4 hover:underline"
                href={emailHref(publicSite.privacyEmail)}
              >
                {publicSite.privacyEmail}
              </a>
              . Some information may be retained where needed for security, legal compliance,
              dispute resolution, backups, or billing records.
            </p>
            <p>
              {publicSite.trust.noDataSelling} We also do not share personal information for
              cross-context behavioral advertising.
            </p>
            <p>{publicSite.trust.exportAvailability}</p>
          </>
        ),
      },
      {
        title: 'Retention and deletion',
        content: (
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
        ),
      },
      {
        title: 'Children',
        content: (
          <p>
            {publicSite.brandName} is not intended for children under {publicSite.minimumAge}. If
            you believe a child under {publicSite.minimumAge} has provided personal information,
            contact us at{' '}
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={emailHref(publicSite.privacyEmail)}
            >
              {publicSite.privacyEmail}
            </a>
            .
          </p>
        ),
      },
      {
        title: 'Contact',
        content: (
          <>
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
          </>
        ),
      },
    ],
  },
} satisfies Record<string, PublicPolicyPageContent>

export const publicSecurityPage = {
  title: 'Privacy & Security',
  description: `${publicSite.brandName} is designed around private content, controlled access, and practical monitoring that helps keep the product reliable.`,
  head: {
    title: 'Privacy & Security',
    description:
      "Privacy, security, monitoring, and data protection practices for The Wizard's Archive.",
  },
  principles: [
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
      body: 'Consent-based analytics help us maintain reliability and improve the product.',
      icon: ShieldCheck,
    },
    {
      title: 'Account protection',
      body: 'Authentication, sessions, and account emails are handled through service providers that support secure account operations.',
      icon: KeyRound,
    },
  ],
  sections: [
    {
      title: 'Data ownership and privacy',
      content: (
        <p>
          {publicSite.trust.contentOwnership} {publicSite.trust.exportAvailability}{' '}
          {publicSite.trust.noAiTraining}
        </p>
      ),
    },
    {
      title: 'Access controls',
      content: (
        <p>
          Access is controlled through user accounts, campaign membership, invites, and sharing
          settings.
        </p>
      ),
    },
    {
      title: 'Infrastructure and payments',
      content: (
        <p>
          We use service providers for hosting, database, authentication, email, storage, security,
          analytics, and payments. Payment details are handled by Stripe when subscriptions are
          enabled. The app does not store full card numbers.
        </p>
      ),
    },
    {
      title: 'Monitoring',
      content: (
        <>
          <p>
            We use {publicSite.analyticsVendors.join(', ')} for product analytics. Product analytics
            helps us understand and improve the service.
          </p>
          <p>{publicSite.trust.analyticsExclusion}</p>
        </>
      ),
    },
    {
      title: 'Limits of this summary',
      content: (
        <p>
          This page is a practical overview, not an enterprise security whitepaper or compliance
          certification. For the controlling legal details, review the Privacy Policy and Terms of
          Service.
        </p>
      ),
    },
    {
      title: 'Cookies and preferences',
      content: (
        <p>
          Essential cookies and similar storage support login, security, sessions, and app
          preferences. Non-essential analytics storage is controlled through privacy preferences.
        </p>
      ),
    },
    {
      title: 'Security contact',
      content: (
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
      ),
    },
  ],
} satisfies PublicSecurityPageContent
