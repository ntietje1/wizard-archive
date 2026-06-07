import type { ReactNode } from 'react'

interface SidebarWorkspaceShellProps {
  children: ReactNode
  sidebar: ReactNode
}

export function SidebarWorkspaceShell({ children, sidebar }: SidebarWorkspaceShellProps) {
  return (
    <div className="relative flex flex-1 min-h-0 min-w-0">
      {sidebar}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
