export function MapViewerSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full h-full min-h-0 bg-background overflow-hidden flex flex-col"
    >
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <div className="bg-muted rounded-md size-8" />
        <div className="bg-muted rounded-md size-8" />
        <div className="bg-muted rounded-md size-8" />
      </div>
    </div>
  )
}
