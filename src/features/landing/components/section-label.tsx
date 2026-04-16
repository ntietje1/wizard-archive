export function SectionLabel({ children }: { children: string }) {
  return (
    <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </span>
  )
}
