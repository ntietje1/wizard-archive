import { describe, expect, it } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { MenuContext } from '~/features/context-menu/types'
import type { GameMapWithContent } from 'convex/gameMaps/types'
import { VIEW_CONTEXT } from '~/features/context-menu/constants'
import * as p from '~/features/context-menu/predicates'
import {
  createGameMap,
  createNote,
} from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function ctx(overrides: Partial<MenuContext> = {}): MenuContext {
  return {
    item: undefined,
    viewContext: VIEW_CONTEXT.SIDEBAR,
    ...overrides,
  }
}

describe('always / never', () => {
  it('always returns true', () => expect(p.always(ctx())).toBe(true))
  it('never returns false', () => expect(p.never(ctx())).toBe(false))
})

describe('isSidebarItem', () => {
  it('true when item is defined', () => {
    expect(p.isSidebarItem(ctx({ item: createNote() }))).toBe(true)
  })
  it('false when item is undefined', () => {
    expect(p.isSidebarItem(ctx())).toBe(false)
  })
})

describe('isType / isNotType', () => {
  it('isType matches correct type', () => {
    expect(
      p.isType(SIDEBAR_ITEM_TYPES.notes)(ctx({ item: createNote() })),
    ).toBe(true)
    expect(
      p.isType(SIDEBAR_ITEM_TYPES.folders)(ctx({ item: createNote() })),
    ).toBe(false)
  })

  it('isType matches any of multiple types', () => {
    expect(
      p.isType(
        SIDEBAR_ITEM_TYPES.notes,
        SIDEBAR_ITEM_TYPES.folders,
      )(ctx({ item: createNote() })),
    ).toBe(true)
  })

  it('isType returns false for undefined item', () => {
    expect(p.isType(SIDEBAR_ITEM_TYPES.notes)(ctx())).toBe(false)
  })

  it('isNotType is inverse of isType', () => {
    expect(
      p.isNotType(SIDEBAR_ITEM_TYPES.folders)(ctx({ item: createNote() })),
    ).toBe(true)
    expect(
      p.isNotType(SIDEBAR_ITEM_TYPES.notes)(ctx({ item: createNote() })),
    ).toBe(false)
  })

  it('isNotType returns true for undefined item', () => {
    expect(p.isNotType(SIDEBAR_ITEM_TYPES.notes)(ctx())).toBe(true)
  })
})

describe('view context predicates', () => {
  it('inView matches correct view', () => {
    expect(p.inView(VIEW_CONTEXT.SIDEBAR)(ctx())).toBe(true)
    expect(p.inView(VIEW_CONTEXT.TOPBAR)(ctx())).toBe(false)
  })

  it('inView accepts multiple views', () => {
    expect(p.inView(VIEW_CONTEXT.SIDEBAR, VIEW_CONTEXT.TOPBAR)(ctx())).toBe(
      true,
    )
  })

  it('notInView is inverse of inView', () => {
    expect(p.notInView(VIEW_CONTEXT.TOPBAR)(ctx())).toBe(true)
    expect(p.notInView(VIEW_CONTEXT.SIDEBAR)(ctx())).toBe(false)
  })

  it('inSidebar / notInSidebar', () => {
    expect(p.inSidebar(ctx())).toBe(true)
    expect(p.notInSidebar(ctx())).toBe(false)
    expect(p.inSidebar(ctx({ viewContext: VIEW_CONTEXT.TOPBAR }))).toBe(false)
  })

  it('atRoot returns true when no item', () => {
    expect(p.atRoot(ctx())).toBe(true)
    expect(p.atRoot(ctx({ item: createNote() }))).toBe(false)
  })
})

describe('role predicates', () => {
  it('isDm / isPlayer', () => {
    expect(p.isDm(ctx({ memberRole: CAMPAIGN_MEMBER_ROLE.DM }))).toBe(true)
    expect(p.isDm(ctx({ memberRole: CAMPAIGN_MEMBER_ROLE.Player }))).toBe(false)
    expect(p.isPlayer(ctx({ memberRole: CAMPAIGN_MEMBER_ROLE.Player }))).toBe(
      true,
    )
    expect(p.isPlayer(ctx({ memberRole: CAMPAIGN_MEMBER_ROLE.DM }))).toBe(false)
  })

  it('isDm returns false when memberRole is undefined', () => {
    expect(p.isDm(ctx())).toBe(false)
  })

  it('isPlayer returns false when memberRole is undefined', () => {
    expect(p.isPlayer(ctx())).toBe(false)
  })
})

describe('permission predicates', () => {
  it('hasViewAccess includes VIEW and higher', () => {
    expect(
      p.hasViewAccess(ctx({ permissionLevel: PERMISSION_LEVEL.VIEW })),
    ).toBe(true)
    expect(
      p.hasViewAccess(ctx({ permissionLevel: PERMISSION_LEVEL.EDIT })),
    ).toBe(true)
    expect(
      p.hasViewAccess(ctx({ permissionLevel: PERMISSION_LEVEL.FULL_ACCESS })),
    ).toBe(true)
    expect(
      p.hasViewAccess(ctx({ permissionLevel: PERMISSION_LEVEL.NONE })),
    ).toBe(false)
  })

  it('hasEditAccess includes EDIT and higher', () => {
    expect(
      p.hasEditAccess(ctx({ permissionLevel: PERMISSION_LEVEL.VIEW })),
    ).toBe(false)
    expect(
      p.hasEditAccess(ctx({ permissionLevel: PERMISSION_LEVEL.EDIT })),
    ).toBe(true)
    expect(
      p.hasEditAccess(ctx({ permissionLevel: PERMISSION_LEVEL.FULL_ACCESS })),
    ).toBe(true)
  })

  it('hasFullAccess requires FULL_ACCESS', () => {
    expect(
      p.hasFullAccess(ctx({ permissionLevel: PERMISSION_LEVEL.EDIT })),
    ).toBe(false)
    expect(
      p.hasFullAccess(ctx({ permissionLevel: PERMISSION_LEVEL.FULL_ACCESS })),
    ).toBe(true)
  })
})

describe('trash predicates', () => {
  it('isItemTrashed / isItemNotTrashed', () => {
    expect(p.isItemTrashed(ctx({ isItemTrashed: true }))).toBe(true)
    expect(p.isItemTrashed(ctx({ isItemTrashed: false }))).toBe(false)
    expect(p.isItemTrashed(ctx())).toBe(false)
    expect(p.isItemNotTrashed(ctx({ isItemTrashed: true }))).toBe(false)
    expect(p.isItemNotTrashed(ctx())).toBe(true)
  })

  it('isTrashView', () => {
    expect(p.isTrashView(ctx({ isTrashView: true }))).toBe(true)
    expect(p.isTrashView(ctx())).toBe(false)
  })
})

describe('map predicates', () => {
  const mockMap = {
    _id: testId<'gameMaps'>('map_1'),
    pins: [{ itemId: testId<'notes'>('note_pinned') }],
  } as unknown as GameMapWithContent

  it('hasActiveMap', () => {
    expect(p.hasActiveMap(ctx({ activeMap: mockMap }))).toBe(true)
    expect(p.hasActiveMap(ctx())).toBe(false)
  })

  it('isPinnedOnActiveMap', () => {
    const pinnedNote = createNote({ _id: testId<'notes'>('note_pinned') })
    const unpinnedNote = createNote({ _id: testId<'notes'>('note_other') })
    expect(
      p.isPinnedOnActiveMap(ctx({ item: pinnedNote, activeMap: mockMap })),
    ).toBe(true)
    expect(
      p.isPinnedOnActiveMap(ctx({ item: unpinnedNote, activeMap: mockMap })),
    ).toBe(false)
    expect(p.isPinnedOnActiveMap(ctx({ item: pinnedNote }))).toBe(false)
  })

  it('isActiveMap / isNotActiveMap', () => {
    const mapItem = createGameMap({ _id: mockMap._id })
    const otherItem = createNote()
    expect(p.isActiveMap(ctx({ item: mapItem, activeMap: mockMap }))).toBe(true)
    expect(p.isActiveMap(ctx({ item: otherItem, activeMap: mockMap }))).toBe(
      false,
    )
    expect(p.isNotActiveMap(ctx({ item: otherItem, activeMap: mockMap }))).toBe(
      true,
    )
    expect(p.isNotActiveMap(ctx({ item: mapItem, activeMap: mockMap }))).toBe(
      false,
    )
  })
})

describe('session predicates', () => {
  it('hasActiveSession / hasNoActiveSession', () => {
    expect(p.hasActiveSession(ctx({ hasActiveSession: true }))).toBe(true)
    expect(p.hasActiveSession(ctx())).toBe(false)
    expect(p.hasNoActiveSession(ctx())).toBe(true)
    expect(p.hasNoActiveSession(ctx({ hasActiveSession: true }))).toBe(false)
  })
})

describe('editor predicates', () => {
  it('hasBlockNoteEditor', () => {
    expect(p.hasBlockNoteEditor(ctx({ editor: {} as never }))).toBe(true)
    expect(p.hasBlockNoteEditor(ctx())).toBe(false)
  })

  it('hasBlockId', () => {
    expect(p.hasBlockId(ctx({ blockId: 'b1' }))).toBe(true)
    expect(p.hasBlockId(ctx())).toBe(false)
  })
})
