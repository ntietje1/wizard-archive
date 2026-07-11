import { toast } from 'sonner'

import { getClientErrorMessage } from '../../../../shared/errors/client'
import type { DropRejectionReason } from './rejections'
import { rejectionReasonMessage } from './rejections'

export type SurfaceDropCommandEffects = {
  reportError: (error: unknown, fallbackMessage: string) => void
  reportRejection: (reason: DropRejectionReason) => void
  reportRejections: (reasons: ReadonlyArray<DropRejectionReason>) => void
}

export function createSurfaceDropCommandUiEffects(): SurfaceDropCommandEffects {
  return {
    reportError: (error, fallbackMessage) => {
      const message = getClientErrorMessage(error) ?? fallbackMessage
      toast.error(message)
      console.error(message)
    },
    reportRejection: (reason) => {
      toast.error(rejectionReasonMessage(reason))
    },
    reportRejections: (reasons) => {
      if (reasons.length === 0) return
      const messages = new Set(reasons.map((reason) => rejectionReasonMessage(reason)))
      toast.error([...messages].join('; '))
    },
  }
}
