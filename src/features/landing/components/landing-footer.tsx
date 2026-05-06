import { LandingContainer } from '~/features/landing/components/landing-container'
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
            <p className="mt-3 text-sm text-muted-foreground">
              The collaborative campaign manager for TTRPGs.
            </p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Changelog', href: '#' },
            ]}
          />

          <FooterColumn
            title="Community"
            links={[
              { label: 'Discord', href: 'https://discord.gg/VhfzjsaXTD', external: true },
              {
                label: 'GitHub',
                href: 'https://github.com/ntietje1/wizard-archive',
                external: true,
              },
            ]}
          />

          <FooterColumn
            title="Legal"
            links={[
              { label: 'Privacy Policy', href: '#' },
              { label: 'Terms of Service', href: '#' },
            ]}
          />
        </div>

        <div className="mt-12 border-t border-border/20 pt-8">
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {`© ${new Date().getFullYear()} Wizard's Archive. All rights reserved.`}
          </p>
        </div>
      </LandingContainer>
    </footer>
  )
}
