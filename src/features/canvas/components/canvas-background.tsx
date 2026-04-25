export function CanvasBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 14%, transparent) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    />
  )
}
