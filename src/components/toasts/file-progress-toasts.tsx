import { Progress } from '../shadcn/ui/progress'
import type { UploadProgress } from '~/hooks/useFileDropHandler'

export const ToastContent = ({
  title,
  message,
  progress,
}: {
  title: string
  message: string
  progress?: number
}) => (
  <div className="space-y-2 w-full min-w-[300px]">
    <div className="font-medium text-sm">{title}</div>
    {progress !== undefined && (
      <Progress value={progress} className="h-1.5 w-full" />
    )}
    <div className="text-xs text-muted-foreground">{message}</div>
  </div>
)

export const FileProgressContent = ({
  totalFiles,
  processedFiles,
  skippedFiles,
}: {
  totalFiles: number
  processedFiles: number
  skippedFiles: number
}) => {
  const percentage =
    totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0

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

export const FolderProgressContent = ({
  progress,
}: {
  progress: UploadProgress
}) => {
  const {
    totalFiles,
    totalFolders,
    processedFiles,
    processedFolders,
    skippedFiles,
  } = progress
  const percentage =
    totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0

  return (
    <div className="space-y-2 w-full min-w-[300px]">
      <div className="font-medium text-sm">Uploading folder contents</div>
      <Progress value={percentage} className="h-1.5 w-full" />
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>
          Folders: {processedFolders}/{totalFolders}
        </div>
        <div>
          Files: {processedFiles}/{totalFiles}
          {skippedFiles > 0 && ` (${skippedFiles} skipped)`}
        </div>
      </div>
    </div>
  )
}
