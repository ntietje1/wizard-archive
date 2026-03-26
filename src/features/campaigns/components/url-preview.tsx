interface UrlPreviewProps {
  url: string
  label?: string
}

export function UrlPreview({
  url,
  label = 'Your campaign will be available at:',
}: UrlPreviewProps) {
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <span className="font-medium block">{label}</span>
      <div
        className="font-mono bg-muted p-2 rounded border break-all text-foreground max-w-full overflow-hidden text-xs"
        title={url}
        aria-live="polite"
        data-testid="url-preview"
      >
        {url}
      </div>
    </div>
  )
}
