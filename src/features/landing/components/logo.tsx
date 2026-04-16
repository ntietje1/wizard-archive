import { cn } from '~/features/shadcn/lib/utils'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt="Wizard's Archive"
      width="1024"
      height="1024"
      className={cn('invert', className)}
    />
  )
}
