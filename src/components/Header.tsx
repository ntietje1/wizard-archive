import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SignedIn, UserButton } from '@clerk/tanstack-react-start'

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
              The Wizard's Archive
            </Link>
          </div>
          {children}
        </header>
        <div className="ml-auto">
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </div>
  )
}
