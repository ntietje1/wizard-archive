import { VIEW_CONTEXT } from '../view-context'
import type { Predicate, ViewContext } from '../menu-context'

export const isSidebarItem: Predicate = (ctx) => ctx.item !== undefined

export const inView =
  (...views: Array<ViewContext>): Predicate =>
  (ctx) =>
    views.includes(ctx.surface)

export const inSidebar: Predicate = (ctx) => ctx.surface === VIEW_CONTEXT.SIDEBAR

export const atRoot: Predicate = (ctx) => !isSidebarItem(ctx)
