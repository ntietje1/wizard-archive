export function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
        {children}
      </div>
    </div>
  )
}
