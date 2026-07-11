export function PdfFailureMessage({ message = 'Failed to load PDF' }: { message?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4" role="alert">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
