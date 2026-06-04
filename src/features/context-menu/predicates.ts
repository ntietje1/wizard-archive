import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { VIEW_CONTEXT } from './constants'
import { getSidebarFilesystemCapabilities } from '~/features/filesystem/filesystem-capabilities'
import type { Predicate, ViewContext } from './types'
import type { SidebarItemType } from 'shared/sidebar-items/types'

type PredicateContext = Parameters<Predicate>[0]

export const isSidebarItem: Predicate = (ctx) => ctx.item !== undefined

export const isSingleSelection: Predicate = (ctx) =>
  (ctx.selectedItems?.length ?? (ctx.item ? 1 : 0)) <= 1

// selectedItems is authoritative when present, even if empty; item is the single-item fallback.
export const hasSelection: Predicate = (ctx) =>
  (ctx.selectedItems?.length ?? (ctx.item ? 1 : 0)) > 0

function selectedItems(ctx: PredicateContext) {
  return ctx.selectedItems ?? (ctx.item ? [ctx.item] : [])
}

function selectedFilesystemItems(ctx: PredicateContext) {
  const items = selectedItems(ctx)
  if (ctx.selectedItems !== undefined || ctx.permissionLevel === undefined) return items
  return items.map((item) => ({ ...item, myPermissionLevel: ctx.permissionLevel }))
}

function selectedItemHasFullAccess(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    return ctx.selectedItems[itemIndex]?.myPermissionLevel === PERMISSION_LEVEL.FULL_ACCESS
  }
  return hasFullAccess(ctx)
}

function selectedItemHasEditAccess(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    const permissionLevel = ctx.selectedItems[itemIndex]?.myPermissionLevel
    return (
      permissionLevel === PERMISSION_LEVEL.EDIT || permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
    )
  }
  return hasEditAccess(ctx)
}

function selectedItemHasViewAccess(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    const permissionLevel = ctx.selectedItems[itemIndex]?.myPermissionLevel
    return (
      permissionLevel === PERMISSION_LEVEL.VIEW ||
      permissionLevel === PERMISSION_LEVEL.EDIT ||
      permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
    )
  }
  return hasViewAccess(ctx)
}

function selectedItemIsTrashed(ctx: PredicateContext, itemIndex: number): boolean {
  if (ctx.selectedItems !== undefined) {
    const item = ctx.selectedItems[itemIndex]
    return item?.isTrashed === true
  }
  return isItemTrashed(ctx)
}

export const isType =
  (...types: Array<SidebarItemType>): Predicate =>
  (ctx) =>
    ctx.item ? types.includes(ctx.item.type) : false

export const isNotType =
  (...types: Array<SidebarItemType>): Predicate =>
  (ctx) =>
    ctx.item ? !types.includes(ctx.item.type) : true

export const inView =
  (...views: Array<ViewContext>): Predicate =>
  (ctx) =>
    views.includes(ctx.surface)

export const inSidebar: Predicate = (ctx) => ctx.surface === VIEW_CONTEXT.SIDEBAR

export const hasBlockNoteId: Predicate = (ctx) => ctx.blockNoteId !== undefined

export const isEditorTextContext: Predicate = (ctx) =>
  ctx.surface === VIEW_CONTEXT.NOTE_VIEW && ctx.isEditorTextContext === true

export const hasEditorTextSelection: Predicate = (ctx) => {
  if (!isEditorTextContext(ctx)) return false

  const editorElement = getEditorElement(ctx)
  const selection = window.getSelection?.()
  if (!editorElement || !selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false
  }

  return editorElementContainsNode(editorElement, selection.anchorNode)
}

export const hasEditableValueInlineId: Predicate = (ctx) =>
  ctx.valueInlineId !== undefined && ctx.valueInlineEditable === true

function getEditorElement(ctx: PredicateContext): HTMLElement | null {
  return (
    getEditorDomElement(ctx.editor) ??
    getEditorViewDom(ctx.editor) ??
    getPrivateTiptapEditorViewDom(ctx.editor)
  )
}

function getEditorDomElement(editor: unknown): HTMLElement | null {
  if (!isRecord(editor)) return null
  return editor.domElement instanceof HTMLElement ? editor.domElement : null
}

function getEditorViewDom(editor: unknown): HTMLElement | null {
  if (!isRecord(editor)) return null
  const view = editor.view
  if (!isRecord(view)) return null
  return view.dom instanceof HTMLElement ? view.dom : null
}

function getPrivateTiptapEditorViewDom(editor: unknown): HTMLElement | null {
  if (!isRecord(editor)) return null
  const tiptapEditor = editor._tiptapEditor
  if (!isRecord(tiptapEditor)) return null
  const view = tiptapEditor.view
  if (!isRecord(view)) return null
  // NOTE: _tiptapEditor is a private BlockNote escape hatch. Keep this guarded and revisit when
  // BlockNote exposes a stable editor-view DOM accessor.
  return view.dom instanceof HTMLElement ? view.dom : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function editorElementContainsNode(editorElement: HTMLElement, node: Node | null): boolean {
  if (!node) return false
  if (node instanceof Element) return editorElement.contains(node)
  return node.parentElement !== null && editorElement.contains(node.parentElement)
}

export const atRoot: Predicate = (ctx) => !isSidebarItem(ctx)

export const isPinnedOnActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap.pins.some((pin) => pin.itemId === ctx.item?._id)
}

export const isNotActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap._id !== ctx.item._id
}

export const isActiveMap: Predicate = (ctx) => {
  if (!ctx.item || !ctx.activeMap) return false
  return ctx.activeMap._id === ctx.item._id
}

export const hasPinContext: Predicate = (ctx) => {
  return Boolean(ctx.activePin && ctx.activeMap)
}

export const isDm: Predicate = (ctx) => {
  return ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM
}

const hasViewAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.VIEW || hasEditAccess(ctx)
}

export const hasEditAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.EDIT || hasFullAccess(ctx)
}

export const hasFullAccess: Predicate = (ctx) => {
  return ctx.permissionLevel === PERMISSION_LEVEL.FULL_ACCESS
}

export const allSelectedItemsHaveFullAccess: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => selectedItemHasFullAccess(ctx, index))
}

export const allSelectedItemsHaveEditAccess: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => selectedItemHasEditAccess(ctx, index))
}

export const allSelectedItemsHaveViewAccess: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => selectedItemHasViewAccess(ctx, index))
}

export const allSelectedItemsNotTrashed: Predicate = (ctx) => {
  const items = selectedItems(ctx)
  return items.length > 0 && items.every((_, index) => !selectedItemIsTrashed(ctx, index))
}

export const canTrashSelectedItems: Predicate = (ctx) =>
  getSidebarFilesystemCapabilities(ctx.memberRole, selectedFilesystemItems(ctx)).canTrash

export const canRestoreSelectedItems: Predicate = (ctx) =>
  getSidebarFilesystemCapabilities(ctx.memberRole, selectedFilesystemItems(ctx)).canRestore

export const canDeleteSelectedItemsForever: Predicate = (ctx) =>
  getSidebarFilesystemCapabilities(ctx.memberRole, selectedFilesystemItems(ctx)).canDeleteForever

const isItemTrashed: Predicate = (ctx) => ctx.isItemTrashed === true

export const isItemNotTrashed: Predicate = (ctx) => ctx.isItemTrashed !== true

export const isTrashView: Predicate = (ctx) => ctx.isTrashView === true
