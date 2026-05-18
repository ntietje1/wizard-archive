import { LandingContainer } from '~/features/landing/components/landing-container'
import { publicSite } from '~/features/landing/content/public-site'
import { WizardArchiveLogo } from '~/shared/components/wizard-archive-logo'

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ label: string; href: string; external?: boolean }>
}) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-foreground/70 hover:text-foreground"
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border/20 bg-secondary/10 py-16">
      <LandingContainer>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <WizardArchiveLogo className="h-6 w-6" />
              <span className="text-lg font-semibold text-foreground">{"Wizard's Archive"}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{publicSite.tagline}</p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { label: 'Features', href: '/#features' },
              { label: 'Pricing', href: publicSite.routes.pricing },
              { label: 'FAQ', href: publicSite.routes.faq },
              { label: 'Privacy & Security', href: publicSite.routes.security },
            ]}
          />

          <FooterColumn
            title="Community"
            links={[
              { label: 'Community', href: publicSite.routes.community },
              { label: 'Discord', href: publicSite.community.discordUrl, external: true },
              {
                label: 'GitHub',
                href: publicSite.community.githubUrl,
                external: true,
              },
            ]}
          />

          <FooterColumn
            title="Legal"
            links={[
              { label: 'Privacy Policy', href: publicSite.routes.privacy },
              { label: 'Terms of Service', href: publicSite.routes.terms },
              { label: 'Billing Policy', href: publicSite.routes.billing },
            ]}
          />
        </div>

        <div className="mt-12 border-t border-border/20 pt-8">
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {`© ${new Date().getFullYear()} ${publicSite.legalName}. All rights reserved.`}
          </p>
        </div>
      </LandingContainer>
    </footer>
  )
}
