export function InvalidFileUrlMessage({ fileType }: { fileType: string }) {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-muted-foreground"
      role="alert"
    >
      <div className="text-center p-4">
        <p className="text-lg font-medium text-destructive">Invalid {fileType} URL</p>
        <p className="text-sm mt-2">
          The {fileType.toLowerCase()} URL does not meet security requirements.
        </p>
      </div>
    </div>
  )
}
