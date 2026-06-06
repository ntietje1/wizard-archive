export const publicSite = {
  brandName: "The Wizard's Archive",
  legalName: "Wizard's Archive LLC",
  tagline: 'The campaign workspace for tabletop RPG groups.',
  effectiveDate: 'May 3, 2026',
  minimumAge: 13,
  supportEmail: 'support@wizardarchive.com',
  privacyEmail: 'privacy@wizardarchive.com',
  legalEmail: 'legal@wizardarchive.com',
  routes: {
    pricing: '/pricing',
    faq: '/faq',
    community: '/community',
    security: '/security',
    privacy: '/privacy',
    terms: '/terms',
    billing: '/billing',
  },
  // TODO: Implement the consent/preferences UI before enabling non-essential analytics.
  privacyPreferences: {
    label: 'Privacy preferences',
    storageKey: 'wizard-archive-privacy-preferences',
  },
  community: {
    channels: [
      {
        id: 'discord',
        label: 'Discord',
        title: 'Discord',
        body: 'Chat with other users, ask questions, share feedback, and follow product updates.',
        action: 'Join Discord',
        href: 'https://discord.gg/VhfzjsaXTD',
      },
      {
        id: 'github',
        label: 'GitHub',
        title: 'GitHub',
        body: 'View the project, follow development, report bugs, and request technical changes.',
        action: 'View GitHub',
        href: 'https://github.com/ntietje1/wizard-archive',
      },
    ],
  },
  trial: {
    days: 14,
    requiresCreditCard: false,
    short: 'Free for 14 days. No credit card required.',
    disclosure:
      'Start with a 14-day free trial. No credit card is required, and you will not be charged unless you choose a paid plan and add payment information.',
  },
  pricing: {
    monthly: '$10',
    annualMonthly: '$7.50',
    annualTotal: '$90',
    annualSavings: 'Save 25%',
    playerAccess: 'Players always join free. Only the DM needs a subscription.',
  },
  billing: {
    cancellation:
      'Once paid subscriptions are enabled, you will be able to cancel from account settings before the next billing period.',
    refunds:
      'Refund requests are reviewed case by case. Contact support if a charge looks wrong or the product did not work as expected.',
  },
  trust: {
    contentOwnership:
      'You keep ownership of the content you create or upload. We only use it to provide and operate the service.',
    exportAvailability: 'You can export your content as Markdown at any time.',
    privateByDefault:
      'Campaigns are private by default and are not public, indexed, or discoverable.',
    noDataSelling: 'We do not sell personal information.',
    noAdTracking: 'We do not run ads or use ad pixels or retargeting cookies.',
    noAiTraining: 'We do not use private campaign content to train AI models.',
    analyticsExclusion:
      'Private campaign content is not used for analytics, and analytics runs only after consent.',
  },
  essentialVendors: ['Convex', 'Better Auth', 'Resend', 'Cloudflare', 'Stripe'],
  analyticsVendors: ['PostHog'],
  vendors: ['Convex', 'Better Auth', 'Resend', 'Cloudflare', 'Stripe', 'PostHog'],
} as const

export const emailHref = (email: string) => `mailto:${email}`

export const publicPageHead = ({ title, description }: { title: string; description: string }) => {
  const fullTitle = title === publicSite.brandName ? title : `${title} | ${publicSite.brandName}`

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { name: 'og:type', content: 'website' },
      { name: 'og:title', content: fullTitle },
      { name: 'og:description', content: description },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
    ],
  }
}

type PublicFaq = {
  q: string
  a: string
}

export const publicFaqs: Array<PublicFaq> = [
  {
    q: "What makes the Wizard's Archive different from a general notes app?",
    a: "The Wizard's Archive is built around active tabletop campaigns. It combines campaign writing, organization, maps, player access, sharing controls, and Markdown import/export in one focused workspace.",
  },
  {
    q: 'Is this for prep or for play?',
    a: 'Both. Use it to write and organize the campaign before a session, then use the same workspace to share material with players while the campaign is active.',
  },
  {
    q: 'Is this a publishing platform?',
    a: "No. The Wizard's Archive is focused on private campaign management for your table, not public publishing or broad audience building.",
  },
  {
    q: 'Do my players need to pay?',
    a: "No. Players join free via an invite link. Only the DM needs a subscription. There's no limit on how many players can join a campaign.",
  },
  {
    q: 'How does the free trial work?',
    a: `${publicSite.trial.disclosure} After the trial, paid DM features require an active subscription. ${publicSite.pricing.playerAccess}`,
  },
  {
    q: 'How much does the paid plan cost?',
    a: `The Pro plan is ${publicSite.pricing.monthly} per month, or ${publicSite.pricing.annualMonthly} per month when billed annually at ${publicSite.pricing.annualTotal}.`,
  },
  {
    q: 'Can I cancel?',
    a: `${publicSite.billing.cancellation} Canceling stops future renewal charges and does not delete your exported files.`,
  },
  {
    q: 'Are refunds available?',
    a: publicSite.billing.refunds,
  },
  {
    q: 'What TTRPG systems does this support?',
    a: "All of them. The Wizard's Archive is fully system-agnostic. It doesn't have built-in rules or character sheets for any specific system. You organize your campaign however you want.",
  },
  {
    q: 'Can I use this for in-person sessions?',
    a: "Absolutely. The Wizard's Archive works for virtual groups, in-person groups, and hybrid groups. In person, players can pull up the shared campaign on their phones or laptops. Virtual groups use it alongside their voice or video tool of choice.",
  },
  {
    q: 'Can I import my existing notes?',
    a: 'Yes. Import Markdown files, including individual notes or entire folder structures from Markdown-compatible tools.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: `${publicSite.trust.exportAvailability} ${publicSite.trust.contentOwnership}`,
  },
  {
    q: 'Is there a mobile app?',
    a: "Not yet. The Wizard's Archive is a web app that works in any modern browser, including mobile browsers. A dedicated mobile app is something we'd like to build in the future.",
  },
  {
    q: 'Is my data private?',
    a: `Yes. ${publicSite.trust.privateByDefault} Only people you explicitly invite can access them. ${publicSite.trust.noDataSelling} ${publicSite.trust.noAdTracking}`,
  },
  {
    q: 'Do you use analytics?',
    a: `${publicSite.brandName} uses ${publicSite.analyticsVendors.join(', ')} for non-essential product analytics. ${publicSite.trust.analyticsExclusion} Essential cookies and storage are used for login, security, and app preferences.`,
  },
  {
    q: 'How is my campaign data protected?',
    a: `${publicSite.trust.privateByDefault} Access is controlled through accounts, invites, and sharing settings. ${publicSite.trust.noAiTraining}`,
  },
  {
    q: 'Do you use my content to train AI models?',
    a: publicSite.trust.noAiTraining,
  },
  {
    q: 'How do I get support?',
    a: `Email ${publicSite.supportEmail} for account, billing, and product questions.`,
  },
]
