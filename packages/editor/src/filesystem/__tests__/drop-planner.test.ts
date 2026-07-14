import { testResourceId } from '../../../../../shared/test/resource-id'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import { SIDEBAR_ROOT_DROP_TYPE, TRASH_DROP_ZONE_TYPE } from '../../drag-drop/drop-target-data'
import type { DropPlanningContext } from '../../drag-drop/planning-context'
import { createFolder } from '../../test/sidebar-item-factory'
import { resolveFileSystemDropTarget } from '../drop-planner'
import { testCampaignId } from '../../../../../shared/test/campaign-id'

const campaignId = testCampaignId('campaign_1')

function planningContext(overrides?: Partial<DropPlanningContext>): DropPlanningContext {
  return {
    workspaceId: campaignId,
    workspaceName: 'Test Campaign',
    canCreateRootItems: true,
    canManageFolders: true,
    ...overrides,
  }
}

describe('filesystem drop planner', () => {
  it('resolves sidebar drop zones directly to filesystem intent targets', () => {
    const folder = createFolder({ campaignId, name: 'Destination' })
    const folderTarget = { ...folder, ancestorIds: [testResourceId('root')] }

    expect(resolveFileSystemDropTarget({ type: TRASH_DROP_ZONE_TYPE }, planningContext())).toEqual({
      type: 'trash',
      label: 'Trash',
    })
    expect(
      resolveFileSystemDropTarget({ type: SIDEBAR_ROOT_DROP_TYPE }, planningContext()),
    ).toEqual({
      type: 'parent',
      target: { parentId: null, parent: null },
      label: 'Test Campaign',
    })
    expect(resolveFileSystemDropTarget(folderTarget, planningContext())).toEqual({
      type: 'parent',
      target: {
        parentId: folder.id,
        parent: folderTarget,
        ancestorIds: [testResourceId('root')],
      },
      label: 'Destination',
    })
  })

  it('does not keep a second root and folder drop target vocabulary', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/filesystem/drop-planner.ts'),
      'utf8',
    )

    expect(source).not.toContain('toDropIntentTarget')
    expect(source).not.toContain("type: 'root'")
    expect(source).not.toContain("type: 'folder'")
  })

  it('does not own filesystem command labels outside the intent planner', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/filesystem/drop-planner.ts'),
      'utf8',
    )

    expect(source).not.toContain('FileSystemDropCommandPlan')
    expect(source).not.toContain('FileSystemDropRejectionReason')
    expect(source).not.toContain('labelForCommand')
  })
})
