import { v } from 'convex/values'
import { mapValidator } from '../gameMaps/schema'
import { noteValidator } from '../notes/schema'

export const sidebarItemValidator = v.union(noteValidator, mapValidator)
