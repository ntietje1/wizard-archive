import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { UserMenu } from '~/features/auth/components/user-menu'

type HeaderProps = {
  children?: ReactNode
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="bg-background h-10 border-b border-border">
      <div className="mx-auto flex justify-between items-center h-full px-4">
        <Link to="/" className="font-bold text-xl text-primary">
          <span className="whitespace-nowrap">{"Wizard's Archive"}</span>
        </Link>
        {children}
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
