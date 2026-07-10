import { toast } from 'sonner'
import { getClientErrorMessage } from '../../../../shared/errors/client'

export function handleError(error: unknown, fallbackMessage?: string): void {
  const clientMessage = getClientErrorMessage(error)
  toast.error(clientMessage ?? fallbackMessage ?? 'Something went wrong')
  console.error(error)
}
