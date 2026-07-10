import { Progress } from '@wizard-archive/ui/shadcn/components/progress'

export const FileProgressContent = ({
  totalFiles,
  processedFiles,
  skippedFiles,
}: {
  totalFiles: number
  processedFiles: number
  skippedFiles: number
}) => {
  const completedFiles = Math.min(processedFiles + skippedFiles, totalFiles)
  const percentage = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0

  return (
    <div className="space-y-2 w-full min-w-[300px]">
      <div className="font-medium text-sm">Uploading files</div>
      <Progress value={percentage} className="h-1.5 w-full" />
      <div className="text-xs text-muted-foreground">
        Files: {processedFiles}/{totalFiles}
        {skippedFiles > 0 && ` (${skippedFiles} skipped)`}
      </div>
    </div>
  )
}
