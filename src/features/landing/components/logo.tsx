import { cn } from '~/features/shadcn/lib/utils'

export function Logo({ className = '' }: { className?: string }) {
  return <img src="/logo.svg" alt="Wizard's Archive" className={cn('invert', className)} />
}
