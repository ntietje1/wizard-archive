import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { UserMenu } from '~/components/auth/UserMenu'

type HeaderProps = {
  children?: ReactNode
}

export function Header({ children }: HeaderProps) {
  return (
    <div className="bg-background h-10 border-b border-border">
      <div className="mx-auto flex justify-between items-center h-full px-2">
        <header className="bg-background h-10 border-b border-border">
          <div className="mx-auto flex justify-between items-center h-full px-4">
            <Link to="/" className="font-bold text-xl text-primary">
              <span className="whitespace-nowrap">
                {"The Wizard's Archive"}
              </span>
            </Link>
          </div>
          {children}
        </header>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
