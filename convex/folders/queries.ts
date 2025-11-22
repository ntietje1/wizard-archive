import { v } from "convex/values";
import { query } from "../_generated/server";
import { folderValidator, folderWithChildrenValidator } from './schema';
import { getFolderWithChildren, getFolderAncestors as getFolderAncestorsFn } from "./folders";
import { Folder } from "./types";

export const getFolderAncestors = query({
  args: {
    folderId: v.id('folders'),
  },
  returns: v.array(folderValidator),
  handler: async (ctx, args): Promise<Folder[]> => {
    return await getFolderAncestorsFn(ctx, args.folderId)
  },
})

export const getFolder = query({
  args: {
    folderId: v.id('folders'),
  },
  returns: folderWithChildrenValidator,
  handler: async (ctx, args): Promise<Folder> => {
    return await getFolderWithChildren(ctx, args.folderId)
  },
})

