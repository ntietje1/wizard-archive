export function CanvasMenuItem({
  destructive = false,
  disabled = false,
  label,
  onSelect,
}: {
  destructive?: boolean
  disabled?: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent disabled:opacity-50 ${destructive ? 'text-destructive' : ''}`}
      disabled={disabled}
      role="menuitem"
      type="button"
      onClick={onSelect}
    >
      {label}
    </button>
  )
}
