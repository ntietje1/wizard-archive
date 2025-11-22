import { v } from "convex/values";
import { folderValidator } from "../folders/schema";
import { mapValidator } from "../locations/schema";
import { noteValidator } from "../notes/schema";

export const sidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator
)
