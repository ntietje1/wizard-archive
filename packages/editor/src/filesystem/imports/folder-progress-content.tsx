import { Progress } from '@wizard-archive/ui/shadcn/components/progress'

import type { UploadProgress } from './progress-toasts'

export const FolderProgressContent = ({ progress }: { progress: UploadProgress }) => {
  const { totalFiles, totalFolders, processedFiles, processedFolders, skippedFiles } = progress
  const totalItems = totalFiles + totalFolders
  const processedItems = Math.min(processedFiles + processedFolders + skippedFiles, totalItems)
  const percentage = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0

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
        </div>
        {skippedFiles > 0 && <div>Skipped: {skippedFiles}</div>}
      </div>
    </div>
  )
}
