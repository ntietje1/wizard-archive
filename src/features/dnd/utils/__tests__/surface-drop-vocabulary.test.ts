import { describe, expect, it } from 'vitest'
import {
  CANVAS_DROP_ZONE_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from '~/features/dnd/utils/drop-target-data'
import { getSurfaceDropContribution } from '~/features/dnd/utils/surface-drop-vocabulary'

describe('surface drop vocabulary', () => {
  it('names the current surface drop contributions', () => {
    expect(getSurfaceDropContribution('pin')).toEqual({
      action: 'pin',
      commandId: 'surface-drop.pin-sidebar-item-to-map',
      targetType: MAP_DROP_ZONE_TYPE,
      failureMessage: 'Failed to place pins',
    })
    expect(getSurfaceDropContribution('link')).toEqual({
      action: 'link',
      commandId: 'surface-drop.link-sidebar-item-in-note',
      targetType: NOTE_EDITOR_DROP_TYPE,
      failureMessage: 'Failed to add links',
    })
    expect(getSurfaceDropContribution('embed')).toEqual({
      action: 'embed',
      commandId: 'surface-drop.embed-sidebar-item-in-canvas',
      targetType: CANVAS_DROP_ZONE_TYPE,
      failureMessage: 'Failed to add items to canvas',
    })
  })
})
