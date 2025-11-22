import { v } from "convex/values";
import { folderValidator } from "../folders/schema";
import { mapValidator } from '../maps/schema';
import { noteValidator } from "../notes/schema";

export const sidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator
)
