import type { ComponentPropsWithoutRef } from 'react'

type WizardArchiveLogoProps = Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> & {
  alt?: string
}

export function WizardArchiveLogo({
  alt = "Wizard's Archive",
  className,
  height = 1024,
  width = 1024,
  ...props
}: WizardArchiveLogoProps) {
  return (
    <img
      {...props}
      src="/logo.svg"
      alt={alt}
      width={width}
      height={height}
      className={['invert', className].filter(Boolean).join(' ')}
    />
  )
}
