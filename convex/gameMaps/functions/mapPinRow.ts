import type { MapPin } from '@wizard-archive/editor/game-maps/document-contract'
import type { Doc } from '../../_generated/dataModel'

export function mapPinRowToDomain(pin: Doc<'mapPins'>): MapPin {
  const { _id, _creationTime, ...fields } = pin
  return {
    ...fields,
    id: _id,
    createdAt: _creationTime,
  }
}
