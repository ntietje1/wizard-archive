import type { MapResourceContent } from './content-session-contract'

export const WIZARD_MAP_DOCUMENT_VERSION = 'wizardmap-v1' as const

export function encodeWizardMapDocument(content: MapResourceContent): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      version: WIZARD_MAP_DOCUMENT_VERSION,
      content: {
        image: content.image,
        layers: content.layers.map((layer) => ({
          id: layer.id,
          image: layer.image,
          name: layer.name,
        })),
        pins: content.pins.map((pin) => ({
          id: pin.id,
          destination: pin.destination,
          layerId: pin.layerId,
          x: pin.x,
          y: pin.y,
          visible: pin.visible,
        })),
      },
    }),
  )
}
