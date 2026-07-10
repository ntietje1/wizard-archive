import { Progress } from '@wizard-archive/ui/shadcn/components/progress'

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
    {progress !== undefined && <Progress value={progress} className="h-1.5 w-full" />}
    <div className="text-xs text-muted-foreground">{message}</div>
  </div>
)
