import { toast } from 'sonner'

export function reportMapPinCreationResult(pinIds: unknown, requestedCount: number) {
  if (!Array.isArray(pinIds)) {
    throw new Error('Map pin creation returned an invalid result')
  }
  if (pinIds.length > requestedCount) {
    throw new Error('Map pin creation returned too many pins')
  }
  if (pinIds.length === 0) {
    toast.error(requestedCount === 1 ? 'Pin was not placed' : 'No pins were placed')
    return false
  }
  if (pinIds.length < requestedCount) {
    const placedText = pinIds.length === 1 ? '1 pin placed' : `${pinIds.length} pins placed`
    toast.success(`${placedText} on map, ${requestedCount - pinIds.length} skipped`)
    return true
  }
  toast.success(pinIds.length === 1 ? 'Pin placed on map' : `${pinIds.length} pins placed on map`)
  return true
}
