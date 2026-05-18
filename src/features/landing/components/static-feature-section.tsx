import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { buttonVariants } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

type StaticFeatureSectionProps = {
  id?: string
  title: string
  items: Array<string>
  cta: string
  visualDescription: string
  reverse?: boolean
  className?: string
}

export function StaticFeatureSection({
  id,
  title,
  items,
  cta,
  visualDescription,
  reverse = false,
  className,
}: StaticFeatureSectionProps) {
  const copy = (
    <div>
      <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link to="/sign-up" className={buttonVariants({ size: 'lg', className: 'mt-8 px-6' })}>
        {cta}
      </Link>
    </div>
  )

  const visual = <AssetPlaceholder label={visualDescription} />

  return (
    <section id={id} className={cn('py-24', className)}>
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {reverse ? (
            <>
              <div className="order-2 lg:order-1">{visual}</div>
              <div className="order-1 lg:order-2">{copy}</div>
            </>
          ) : (
            <>
              {copy}
              {visual}
            </>
          )}
        </div>
      </LandingContainer>
    </section>
  )
}
