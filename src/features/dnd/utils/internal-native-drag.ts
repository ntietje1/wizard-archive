const INTERNAL_NATIVE_DRAG_TYPE = 'application/x-wizard-archive-internal-drag'

let internalNativeDragActive = false

export function markInternalNativeDrag(dataTransfer: DataTransfer | null) {
  internalNativeDragActive = true
  dataTransfer?.setData(INTERNAL_NATIVE_DRAG_TYPE, 'true')
}

export function clearInternalNativeDrag() {
  internalNativeDragActive = false
}

export function isInternalNativeDrag(dataTransfer: DataTransfer | null) {
  return (
    internalNativeDragActive || (dataTransfer?.types.includes(INTERNAL_NATIVE_DRAG_TYPE) ?? false)
  )
}
