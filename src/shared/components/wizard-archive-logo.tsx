import type { ComponentPropsWithoutRef, CSSProperties } from 'react'
import { cn } from '~/features/shadcn/lib/utils'

const logoMaskStyle = {
  maskImage: 'url("/logo.svg")',
  maskPosition: 'center',
  maskRepeat: 'no-repeat',
  maskSize: 'contain',
  WebkitMaskImage: 'url("/logo.svg")',
  WebkitMaskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
} satisfies CSSProperties

type WizardArchiveLogoProps = ComponentPropsWithoutRef<'span'> & {
  alt?: string
  height?: number | string
  width?: number | string
}

export function WizardArchiveLogo({
  alt = "Wizard's Archive",
  'aria-label': ariaLabel,
  className,
  height,
  role = 'img',
  style,
  width,
  ...props
}: WizardArchiveLogoProps) {
  const sizeStyle = {
    ...(width == null ? null : { width }),
    ...(height == null ? null : { height }),
  } satisfies CSSProperties

  return (
    <span
      {...props}
      aria-label={ariaLabel ?? alt}
      role={role}
      className={cn('inline-block shrink-0 bg-current text-primary', className)}
      style={{ ...logoMaskStyle, ...sizeStyle, ...style }}
    />
  )
}
