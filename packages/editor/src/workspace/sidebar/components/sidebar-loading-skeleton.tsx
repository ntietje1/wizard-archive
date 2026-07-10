export function SidebarLoadingSkeleton({ rows }: { rows: ReadonlyArray<string> }) {
  return (
    <div className="flex-1 p-2">
      <div className="space-y-2">
        {rows.map((widthClassName, index) => (
          <div key={index} className={`bg-muted rounded-md h-4 ${widthClassName}`} />
        ))}
      </div>
    </div>
  )
}
