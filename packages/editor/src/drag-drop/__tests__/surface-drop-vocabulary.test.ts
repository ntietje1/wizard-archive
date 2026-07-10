import { describe, expect, it } from 'vite-plus/test'
import { getSurfaceDropContribution } from '../surface-vocabulary'

describe('surface drop vocabulary', () => {
  it('names the current surface drop contributions', () => {
    expect(getSurfaceDropContribution('pin')).toEqual({
      action: 'pin',
      commandId: 'surface-drop.pin-sidebar-item-to-map',
      failureMessage: 'Failed to place pins',
    })
    expect(getSurfaceDropContribution('link')).toEqual({
      action: 'link',
      commandId: 'surface-drop.link-sidebar-item-in-note',
      failureMessage: 'Failed to add links',
    })
    expect(getSurfaceDropContribution('embed')).toEqual({
      action: 'embed',
      commandId: 'surface-drop.embed-sidebar-item-in-canvas',
      failureMessage: 'Failed to add items to canvas',
    })
    expect(getSurfaceDropContribution('noteEmbed')).toEqual({
      action: 'noteEmbed',
      commandId: 'surface-drop.embed-sidebar-item-in-note',
      failureMessage: 'Failed to add embeds',
    })
  })
})
