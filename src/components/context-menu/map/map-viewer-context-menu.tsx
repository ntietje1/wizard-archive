import { useEffect, useRef } from 'react'
import { MapPinPlus } from '~/lib/icons'

interface MapViewerContextMenuProps {
  position: { x: number; y: number }
  onClose: () => void
  onCreateLocation: () => void
}

export function MapViewerContextMenu({
  position,
  onClose,
  onCreateLocation,
}: MapViewerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as globalThis.Node)
      ) {
        onClose()
      }
    }

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleCreateLocation = () => {
    onCreateLocation()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border rounded-md shadow-lg p-1 z-[2000] min-w-[180px]"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <button
        onClick={handleCreateLocation}
        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-sm flex items-center gap-2"
      >
        <MapPinPlus className="h-4 w-4" />
        Create Location Here
      </button>
    </div>
  )
}
