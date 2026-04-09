import type { LucideIcon } from 'lucide-react'

export function PinMarker({ color, icon: Icon }: { color: string; icon: LucideIcon }) {
  return (
    <div className="relative inline-block">
      <svg
        width="32"
        height="44"
        viewBox="0 0 32 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary-foreground"
        aria-hidden="true"
      >
        <path
          d="M16 0C7.163 0 0 7.163 0 16C0 24.837 16 44 16 44C16 44 32 24.837 32 16C32 7.163 24.837 0 16 0Z"
          fill={color}
        />
        <path
          d="M16 2C8.268 2 2 8.268 2 16C2 22.5 14.5 39 16 41C17.5 39 30 22.5 30 16C30 8.268 23.732 2 16 2Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>
      <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[18px] h-[18px] flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary-foreground" />
      </div>
    </div>
  )
}
