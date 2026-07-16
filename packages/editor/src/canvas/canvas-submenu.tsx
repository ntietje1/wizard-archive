import type { ReactNode } from 'react'

export function CanvasSubmenu({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="group relative">
      <button
        aria-label={label}
        aria-haspopup="menu"
        className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent"
        role="menuitem"
        type="button"
      >
        {label}
        <span className="ml-auto">›</span>
      </button>
      <div
        aria-label={`${label} actions`}
        className="absolute left-full top-0 hidden min-w-40 rounded-md border bg-popover p-1 shadow-md group-focus-within:block group-hover:block"
        role="menu"
      >
        {children}
      </div>
    </div>
  )
}
