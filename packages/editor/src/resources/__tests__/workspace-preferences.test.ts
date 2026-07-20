import { describe, expect, it } from 'vite-plus/test'
import {
  applyWorkspacePreferencePatch,
  DEFAULT_WORKSPACE_PREFERENCES,
  normalizeWorkspacePreferences,
} from '../workspace-preferences'

describe('workspace preferences', () => {
  it('applies independent field patches without revisions', () => {
    const sorted = applyWorkspacePreferencePatch(DEFAULT_WORKSPACE_PREFERENCES, {
      field: 'sort',
      value: { by: 'updated', direction: 'descending' },
    })
    const visible = applyWorkspacePreferencePatch(sorted, {
      field: 'rightPanelVisible',
      value: true,
    })

    expect(visible).toEqual({
      mode: 'editor',
      sort: { by: 'updated', direction: 'descending' },
      panels: { leftVisible: true, rightVisible: true },
    })
  })

  it('uses last-write-wins semantics for the same field', () => {
    const viewer = applyWorkspacePreferencePatch(DEFAULT_WORKSPACE_PREFERENCES, {
      field: 'mode',
      value: 'viewer',
    })
    const editor = applyWorkspacePreferencePatch(viewer, {
      field: 'mode',
      value: 'editor',
    })

    expect(editor.mode).toBe('editor')
  })

  it('normalizes defaults and ignores non-preference panel geometry', () => {
    expect(
      normalizeWorkspacePreferences({
        mode: 'viewer',
        sort: { by: 'created', direction: 'descending' },
        panels: {
          leftVisible: false,
          rightVisible: true,
          leftSize: 320,
          rightSize: 410,
        },
      }),
    ).toEqual({
      mode: 'viewer',
      sort: { by: 'created', direction: 'descending' },
      panels: { leftVisible: false, rightVisible: true },
    })
    expect(normalizeWorkspacePreferences(null)).toEqual(DEFAULT_WORKSPACE_PREFERENCES)
  })
})
