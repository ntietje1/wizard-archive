import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_STATUS } from '../../items-persistence-contract'
import type { WorkspaceMenuContext } from '../../menu-context'
import { VIEW_CONTEXT } from '../../view-context'
import { projectFileSystemActionItem } from '../../../filesystem/action-item'
import * as p from '../predicates'
import * as selection from '../selection'
import { createNote } from '../../../test/sidebar-item-factory'

function ctx(overrides: Partial<WorkspaceMenuContext> = {}): WorkspaceMenuContext {
  const selectedItems =
    overrides.selectedItems ?? (overrides.item === undefined ? [] : [overrides.item])
  return {
    item: undefined,
    selectedItems,
    surface: VIEW_CONTEXT.SIDEBAR,
    ...overrides,
  }
}

describe('isSidebarItem', () => {
  it('matches contexts backed by an item', () => {
    const note = createNote()
    const contexts = [
      { key: 'root', value: ctx() },
      { key: 'item', value: ctx({ item: note }) },
    ]

    expect(contexts.filter(({ value }) => p.isSidebarItem(value)).map(({ key }) => key)).toEqual([
      'item',
    ])
  })
})

describe('view context predicates', () => {
  it('inView matches requested views', () => {
    const contexts = [
      { key: VIEW_CONTEXT.SIDEBAR, value: ctx({ surface: VIEW_CONTEXT.SIDEBAR }) },
      { key: VIEW_CONTEXT.TOPBAR, value: ctx({ surface: VIEW_CONTEXT.TOPBAR }) },
    ]

    expect(
      contexts.filter(({ value }) => p.inView(VIEW_CONTEXT.SIDEBAR)(value)).map(({ key }) => key),
    ).toEqual([VIEW_CONTEXT.SIDEBAR])
  })

  it('inView accepts multiple views', () => {
    expect(p.inView(VIEW_CONTEXT.SIDEBAR, VIEW_CONTEXT.TOPBAR)(ctx())).toBe(true)
  })

  it('inSidebar matches sidebar contexts', () => {
    const contexts = [
      { key: VIEW_CONTEXT.SIDEBAR, value: ctx({ surface: VIEW_CONTEXT.SIDEBAR }) },
      { key: VIEW_CONTEXT.TOPBAR, value: ctx({ surface: VIEW_CONTEXT.TOPBAR }) },
    ]

    expect(contexts.filter(({ value }) => p.inSidebar(value)).map(({ key }) => key)).toEqual([
      VIEW_CONTEXT.SIDEBAR,
    ])
  })

  it('atRoot matches contexts without an item subject', () => {
    const note = createNote()
    const contexts = [
      { key: 'root', value: ctx() },
      { key: 'item', value: ctx({ item: note }) },
    ]

    expect(contexts.filter(({ value }) => p.atRoot(value)).map(({ key }) => key)).toEqual(['root'])
  })
})

describe('permission predicates', () => {
  it('classifies selection cardinality from normalized selected items', () => {
    const first = createNote()
    const second = createNote()
    const contexts = [
      { key: 'empty', value: ctx({ selectedItems: [] }) },
      { key: 'single', value: ctx({ item: first, selectedItems: [first] }) },
      { key: 'multiple', value: ctx({ item: first, selectedItems: [first, second] }) },
    ]

    expect(
      contexts.filter(({ value }) => selection.isSingleSelection(value)).map(({ key }) => key),
    ).toEqual(['single'])
    expect(
      contexts.filter(({ value }) => selection.hasSelection(value)).map(({ key }) => key),
    ).toEqual(['single', 'multiple'])
  })

  it('hasEditAccess includes EDIT and higher', () => {
    const levels = [
      PERMISSION_LEVEL.VIEW,
      PERMISSION_LEVEL.EDIT,
      PERMISSION_LEVEL.FULL_ACCESS,
    ] as const

    expect(
      levels.filter((permissionLevel) => selection.hasEditAccess(ctx({ permissionLevel }))),
    ).toEqual([PERMISSION_LEVEL.EDIT, PERMISSION_LEVEL.FULL_ACCESS])
  })

  it('hasFullAccess requires FULL_ACCESS', () => {
    const levels = [
      PERMISSION_LEVEL.VIEW,
      PERMISSION_LEVEL.EDIT,
      PERMISSION_LEVEL.FULL_ACCESS,
    ] as const

    expect(
      levels.filter((permissionLevel) => selection.hasFullAccess(ctx({ permissionLevel }))),
    ).toEqual([PERMISSION_LEVEL.FULL_ACCESS])
  })

  it('aggregates selected item permissions by operation strength', () => {
    const view = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const edit = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    const full = createNote({ myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS })
    const contexts = [
      { key: 'view', value: ctx({ selectedItems: [view] }) },
      { key: 'edit', value: ctx({ selectedItems: [edit] }) },
      { key: 'full', value: ctx({ selectedItems: [full] }) },
      { key: 'edit-full', value: ctx({ selectedItems: [edit, full] }) },
      { key: 'view-full', value: ctx({ selectedItems: [view, full] }) },
    ]

    expect(
      contexts
        .filter(({ value }) => selection.allSelectedItemsHaveViewAccess(value))
        .map(({ key }) => key),
    ).toEqual(['view', 'edit', 'full', 'edit-full', 'view-full'])
    expect(
      contexts
        .filter(({ value }) => selection.allSelectedItemsHaveEditAccess(value))
        .map(({ key }) => key),
    ).toEqual(['edit', 'full', 'edit-full'])
    expect(
      contexts
        .filter(({ value }) => selection.allSelectedItemsHaveFullAccess(value))
        .map(({ key }) => key),
    ).toEqual(['full'])
  })

  it('projects runtime permission checks onto the strongest item access level', () => {
    const note = createNote()
    const cases = [
      { key: 'none', canView: false, canEdit: false, canFull: false },
      { key: 'view', canView: true, canEdit: false, canFull: false },
      { key: 'edit', canView: true, canEdit: true, canFull: false },
      { key: 'full', canView: true, canEdit: true, canFull: true },
    ]

    expect(
      cases.map(({ key, canView, canEdit, canFull }) => ({
        key,
        permissionLevel: projectFileSystemActionItem(note, {
          canAccessItem: (_item, requiredLevel) =>
            requiredLevel === PERMISSION_LEVEL.VIEW && canView,
          canMutateItem: (_item, requiredLevel) =>
            (requiredLevel === PERMISSION_LEVEL.EDIT && canEdit) ||
            (requiredLevel === PERMISSION_LEVEL.FULL_ACCESS && canFull),
        }).myPermissionLevel,
      })),
    ).toEqual([
      { key: 'none', permissionLevel: PERMISSION_LEVEL.NONE },
      { key: 'view', permissionLevel: PERMISSION_LEVEL.VIEW },
      { key: 'edit', permissionLevel: PERMISSION_LEVEL.EDIT },
      { key: 'full', permissionLevel: PERMISSION_LEVEL.FULL_ACCESS },
    ])
  })
})

describe('trash predicates', () => {
  it('isItemNotTrashed requires an active item subject', () => {
    const active = createNote()
    const trashed = createNote({ status: RESOURCE_STATUS.trashed })
    const contexts = [
      { key: 'root', value: ctx() },
      { key: 'active', value: ctx({ item: active }) },
      { key: 'trashed', value: ctx({ item: trashed }) },
    ]

    expect(
      contexts.filter(({ value }) => selection.isItemNotTrashed(value)).map(({ key }) => key),
    ).toEqual(['active'])
  })

  it('allSelectedItemsNotTrashed reads selected item state', () => {
    const active = createNote()
    const trashed = createNote({ status: RESOURCE_STATUS.trashed })
    const contexts = [
      { key: 'active', value: ctx({ selectedItems: [active] }) },
      { key: 'mixed', value: ctx({ selectedItems: [active, trashed] }) },
    ]

    expect(
      contexts
        .filter(({ value }) => selection.allSelectedItemsNotTrashed(value))
        .map(({ key }) => key),
    ).toEqual(['active'])
  })
})
