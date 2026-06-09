import { createElement } from 'react'
import { toast } from 'sonner'
import { ToastContent } from '~/features/file-upload/components/file-progress-toasts'
import { getErrorMessage } from '~/features/file-upload/utils/file-upload'

export const UPLOAD_TOAST_STYLE = { width: '100%', maxWidth: '100%' } as const

export function showUploadProgressToast({
  fileName,
  percentage,
  toastId,
}: {
  fileName: string
  percentage: number
  toastId: string | number
}) {
  toast.loading(
    createElement(ToastContent, {
      title: fileName,
      message: `Uploading... ${percentage}%`,
      progress: percentage,
    }),
    {
      id: toastId,
      duration: Infinity,
      style: UPLOAD_TOAST_STYLE,
    },
  )
}

export function showSingleFileUploadErrorToast({
  error,
  fileName,
  toastId,
}: {
  error: unknown
  fileName: string
  toastId: string | number
}) {
  toast.dismiss(toastId)
  toast.error(
    createElement(ToastContent, {
      title: fileName,
      message: getErrorMessage(error),
    }),
    {
      duration: 5000,
      style: UPLOAD_TOAST_STYLE,
    },
  )
}
