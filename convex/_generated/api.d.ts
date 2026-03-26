/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as blockShares_functions_blockShareMutations from "../blockShares/functions/blockShareMutations.js";
import type * as blockShares_functions_getBlockPermissionLevel from "../blockShares/functions/getBlockPermissionLevel.js";
import type * as blockShares_functions_getBlockSharesForBlock from "../blockShares/functions/getBlockSharesForBlock.js";
import type * as blockShares_functions_setBlocksShareStatus from "../blockShares/functions/setBlocksShareStatus.js";
import type * as blockShares_functions_shareBlocks from "../blockShares/functions/shareBlocks.js";
import type * as blockShares_functions_unshareBlocks from "../blockShares/functions/unshareBlocks.js";
import type * as blockShares_mutations from "../blockShares/mutations.js";
import type * as blockShares_queries from "../blockShares/queries.js";
import type * as blockShares_types from "../blockShares/types.js";
import type * as blocks_functions_deleteBlocksByNote from "../blocks/functions/deleteBlocksByNote.js";
import type * as blocks_functions_findBlockByBlockNoteId from "../blocks/functions/findBlockByBlockNoteId.js";
import type * as blocks_functions_getBlockWithShares from "../blocks/functions/getBlockWithShares.js";
import type * as blocks_functions_getBlocksWithShares from "../blocks/functions/getBlocksWithShares.js";
import type * as blocks_functions_getTopLevelBlocksByNote from "../blocks/functions/getTopLevelBlocksByNote.js";
import type * as blocks_functions_insertBlock from "../blocks/functions/insertBlock.js";
import type * as blocks_functions_removeBlockIfNotNeeded from "../blocks/functions/removeBlockIfNotNeeded.js";
import type * as blocks_functions_saveTopLevelBlocksForNote from "../blocks/functions/saveTopLevelBlocksForNote.js";
import type * as blocks_functions_updateBlock from "../blocks/functions/updateBlock.js";
import type * as blocks_queries from "../blocks/queries.js";
import type * as blocks_types from "../blocks/types.js";
import type * as bookmarks_functions_deleteItemBookmarks from "../bookmarks/functions/deleteItemBookmarks.js";
import type * as bookmarks_functions_getCampaignBookmarks from "../bookmarks/functions/getCampaignBookmarks.js";
import type * as bookmarks_functions_getItemBookmark from "../bookmarks/functions/getItemBookmark.js";
import type * as bookmarks_functions_toggleItemBookmark from "../bookmarks/functions/toggleItemBookmark.js";
import type * as bookmarks_mutations from "../bookmarks/mutations.js";
import type * as bookmarks_types from "../bookmarks/types.js";
import type * as campaigns_constants from "../campaigns/constants.js";
import type * as campaigns_functions_checkCampaignSlugExists from "../campaigns/functions/checkCampaignSlugExists.js";
import type * as campaigns_functions_createCampaign from "../campaigns/functions/createCampaign.js";
import type * as campaigns_functions_deleteCampaign from "../campaigns/functions/deleteCampaign.js";
import type * as campaigns_functions_getCampaign from "../campaigns/functions/getCampaign.js";
import type * as campaigns_functions_getCampaignMembers from "../campaigns/functions/getCampaignMembers.js";
import type * as campaigns_functions_getUserCampaigns from "../campaigns/functions/getUserCampaigns.js";
import type * as campaigns_functions_joinCampaign from "../campaigns/functions/joinCampaign.js";
import type * as campaigns_functions_updateCampaign from "../campaigns/functions/updateCampaign.js";
import type * as campaigns_functions_updateCampaignMemberStatus from "../campaigns/functions/updateCampaignMemberStatus.js";
import type * as campaigns_mutations from "../campaigns/mutations.js";
import type * as campaigns_queries from "../campaigns/queries.js";
import type * as campaigns_types from "../campaigns/types.js";
import type * as campaigns_validation from "../campaigns/validation.js";
import type * as common_constants from "../common/constants.js";
import type * as common_slug from "../common/slug.js";
import type * as common_types from "../common/types.js";
import type * as crons from "../crons.js";
import type * as editors_functions_getCurrentEditor from "../editors/functions/getCurrentEditor.js";
import type * as editors_functions_setCurrentEditor from "../editors/functions/setCurrentEditor.js";
import type * as editors_mutations from "../editors/mutations.js";
import type * as editors_queries from "../editors/queries.js";
import type * as editors_types from "../editors/types.js";
import type * as email from "../email.js";
import type * as errors from "../errors.js";
import type * as files_functions_createFile from "../files/functions/createFile.js";
import type * as files_functions_deleteFile from "../files/functions/deleteFile.js";
import type * as files_functions_enhanceFile from "../files/functions/enhanceFile.js";
import type * as files_functions_getFile from "../files/functions/getFile.js";
import type * as files_functions_updateFile from "../files/functions/updateFile.js";
import type * as files_mutations from "../files/mutations.js";
import type * as files_queries from "../files/queries.js";
import type * as files_types from "../files/types.js";
import type * as folders_baseSchema from "../folders/baseSchema.js";
import type * as folders_functions_createFolder from "../folders/functions/createFolder.js";
import type * as folders_functions_deleteFolder from "../folders/functions/deleteFolder.js";
import type * as folders_functions_enhanceFolder from "../folders/functions/enhanceFolder.js";
import type * as folders_functions_getFolder from "../folders/functions/getFolder.js";
import type * as folders_functions_getFolderContentsForDownload from "../folders/functions/getFolderContentsForDownload.js";
import type * as folders_functions_getSidebarItemAncestors from "../folders/functions/getSidebarItemAncestors.js";
import type * as folders_functions_updateFolder from "../folders/functions/updateFolder.js";
import type * as folders_mutations from "../folders/mutations.js";
import type * as folders_queries from "../folders/queries.js";
import type * as folders_types from "../folders/types.js";
import type * as functions from "../functions.js";
import type * as gameMaps_baseSchema from "../gameMaps/baseSchema.js";
import type * as gameMaps_functions_createItemPin from "../gameMaps/functions/createItemPin.js";
import type * as gameMaps_functions_createMap from "../gameMaps/functions/createMap.js";
import type * as gameMaps_functions_deleteMap from "../gameMaps/functions/deleteMap.js";
import type * as gameMaps_functions_enhanceMap from "../gameMaps/functions/enhanceMap.js";
import type * as gameMaps_functions_getMap from "../gameMaps/functions/getMap.js";
import type * as gameMaps_functions_removeItemPin from "../gameMaps/functions/removeItemPin.js";
import type * as gameMaps_functions_updateItemPin from "../gameMaps/functions/updateItemPin.js";
import type * as gameMaps_functions_updateMap from "../gameMaps/functions/updateMap.js";
import type * as gameMaps_functions_updatePinVisibility from "../gameMaps/functions/updatePinVisibility.js";
import type * as gameMaps_mutations from "../gameMaps/mutations.js";
import type * as gameMaps_queries from "../gameMaps/queries.js";
import type * as gameMaps_types from "../gameMaps/types.js";
import type * as gameMaps_validation from "../gameMaps/validation.js";
import type * as http from "../http.js";
import type * as notes_editorSpecs from "../notes/editorSpecs.js";
import type * as notes_functions_createNote from "../notes/functions/createNote.js";
import type * as notes_functions_deleteNote from "../notes/functions/deleteNote.js";
import type * as notes_functions_enhanceNote from "../notes/functions/enhanceNote.js";
import type * as notes_functions_getNote from "../notes/functions/getNote.js";
import type * as notes_functions_updateNote from "../notes/functions/updateNote.js";
import type * as notes_functions_updateNoteContent from "../notes/functions/updateNoteContent.js";
import type * as notes_mutations from "../notes/mutations.js";
import type * as notes_queries from "../notes/queries.js";
import type * as notes_types from "../notes/types.js";
import type * as permissions_hasAtLeastPermissionLevel from "../permissions/hasAtLeastPermissionLevel.js";
import type * as permissions_types from "../permissions/types.js";
import type * as prosemirrorSync from "../prosemirrorSync.js";
import type * as sessions_functions_endCurrentSession from "../sessions/functions/endCurrentSession.js";
import type * as sessions_functions_getCurrentSession from "../sessions/functions/getCurrentSession.js";
import type * as sessions_functions_getSession from "../sessions/functions/getSession.js";
import type * as sessions_functions_getSessionsByCampaign from "../sessions/functions/getSessionsByCampaign.js";
import type * as sessions_functions_setCurrentSession from "../sessions/functions/setCurrentSession.js";
import type * as sessions_functions_startSession from "../sessions/functions/startSession.js";
import type * as sessions_functions_updateSession from "../sessions/functions/updateSession.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as sessions_types from "../sessions/types.js";
import type * as sidebarItems_functions_applyToDependents from "../sidebarItems/functions/applyToDependents.js";
import type * as sidebarItems_functions_applyToTree from "../sidebarItems/functions/applyToTree.js";
import type * as sidebarItems_functions_collectDescendants from "../sidebarItems/functions/collectDescendants.js";
import type * as sidebarItems_functions_defaultItemName from "../sidebarItems/functions/defaultItemName.js";
import type * as sidebarItems_functions_emptyTrashBin from "../sidebarItems/functions/emptyTrashBin.js";
import type * as sidebarItems_functions_enhanceSidebarItem from "../sidebarItems/functions/enhanceSidebarItem.js";
import type * as sidebarItems_functions_fetchCampaignSidebarItems from "../sidebarItems/functions/fetchCampaignSidebarItems.js";
import type * as sidebarItems_functions_getSidebarItemById from "../sidebarItems/functions/getSidebarItemById.js";
import type * as sidebarItems_functions_getSidebarItemBySlug from "../sidebarItems/functions/getSidebarItemBySlug.js";
import type * as sidebarItems_functions_getSidebarItemsByParent from "../sidebarItems/functions/getSidebarItemsByParent.js";
import type * as sidebarItems_functions_hardDeleteItem from "../sidebarItems/functions/hardDeleteItem.js";
import type * as sidebarItems_functions_moveSidebarItem from "../sidebarItems/functions/moveSidebarItem.js";
import type * as sidebarItems_functions_permanentlyDeleteSidebarItem from "../sidebarItems/functions/permanentlyDeleteSidebarItem.js";
import type * as sidebarItems_functions_purgeExpiredTrash from "../sidebarItems/functions/purgeExpiredTrash.js";
import type * as sidebarItems_internalMutations from "../sidebarItems/internalMutations.js";
import type * as sidebarItems_mutations from "../sidebarItems/mutations.js";
import type * as sidebarItems_queries from "../sidebarItems/queries.js";
import type * as sidebarItems_schema_baseFields from "../sidebarItems/schema/baseFields.js";
import type * as sidebarItems_schema_baseValidators from "../sidebarItems/schema/baseValidators.js";
import type * as sidebarItems_schema_contentSchema from "../sidebarItems/schema/contentSchema.js";
import type * as sidebarItems_sharedValidation from "../sidebarItems/sharedValidation.js";
import type * as sidebarItems_types_baseTypes from "../sidebarItems/types/baseTypes.js";
import type * as sidebarItems_types_types from "../sidebarItems/types/types.js";
import type * as sidebarItems_validation from "../sidebarItems/validation.js";
import type * as sidebarShares_functions_getCampaignShares from "../sidebarShares/functions/getCampaignShares.js";
import type * as sidebarShares_functions_getSidebarItemShares from "../sidebarShares/functions/getSidebarItemShares.js";
import type * as sidebarShares_functions_getSidebarItemSharesForItem from "../sidebarShares/functions/getSidebarItemSharesForItem.js";
import type * as sidebarShares_functions_getSidebarItemWithShares from "../sidebarShares/functions/getSidebarItemWithShares.js";
import type * as sidebarShares_functions_setAllPlayersPermission from "../sidebarShares/functions/setAllPlayersPermission.js";
import type * as sidebarShares_functions_setFolderInheritShares from "../sidebarShares/functions/setFolderInheritShares.js";
import type * as sidebarShares_functions_shareSidebarItem from "../sidebarShares/functions/shareSidebarItem.js";
import type * as sidebarShares_functions_sidebarItemPermissions from "../sidebarShares/functions/sidebarItemPermissions.js";
import type * as sidebarShares_functions_sidebarItemShareMutations from "../sidebarShares/functions/sidebarItemShareMutations.js";
import type * as sidebarShares_functions_unshareSidebarItem from "../sidebarShares/functions/unshareSidebarItem.js";
import type * as sidebarShares_mutations from "../sidebarShares/mutations.js";
import type * as sidebarShares_queries from "../sidebarShares/queries.js";
import type * as sidebarShares_types from "../sidebarShares/types.js";
import type * as storage_functions_commitUpload from "../storage/functions/commitUpload.js";
import type * as storage_functions_getDownloadUrl from "../storage/functions/getDownloadUrl.js";
import type * as storage_functions_getStorageMetadata from "../storage/functions/getStorageMetadata.js";
import type * as storage_functions_trackUpload from "../storage/functions/trackUpload.js";
import type * as storage_mutations from "../storage/mutations.js";
import type * as storage_queries from "../storage/queries.js";
import type * as storage_types from "../storage/types.js";
import type * as storage_validation from "../storage/validation.js";
import type * as userPreferences_mutations from "../userPreferences/mutations.js";
import type * as userPreferences_queries from "../userPreferences/queries.js";
import type * as userPreferences_types from "../userPreferences/types.js";
import type * as users_constants from "../users/constants.js";
import type * as users_functions_checkUsernameExists from "../users/functions/checkUsernameExists.js";
import type * as users_functions_getUserProfile from "../users/functions/getUserProfile.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_types from "../users/types.js";
import type * as users_validation from "../users/validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "blockShares/functions/blockShareMutations": typeof blockShares_functions_blockShareMutations;
  "blockShares/functions/getBlockPermissionLevel": typeof blockShares_functions_getBlockPermissionLevel;
  "blockShares/functions/getBlockSharesForBlock": typeof blockShares_functions_getBlockSharesForBlock;
  "blockShares/functions/setBlocksShareStatus": typeof blockShares_functions_setBlocksShareStatus;
  "blockShares/functions/shareBlocks": typeof blockShares_functions_shareBlocks;
  "blockShares/functions/unshareBlocks": typeof blockShares_functions_unshareBlocks;
  "blockShares/mutations": typeof blockShares_mutations;
  "blockShares/queries": typeof blockShares_queries;
  "blockShares/types": typeof blockShares_types;
  "blocks/functions/deleteBlocksByNote": typeof blocks_functions_deleteBlocksByNote;
  "blocks/functions/findBlockByBlockNoteId": typeof blocks_functions_findBlockByBlockNoteId;
  "blocks/functions/getBlockWithShares": typeof blocks_functions_getBlockWithShares;
  "blocks/functions/getBlocksWithShares": typeof blocks_functions_getBlocksWithShares;
  "blocks/functions/getTopLevelBlocksByNote": typeof blocks_functions_getTopLevelBlocksByNote;
  "blocks/functions/insertBlock": typeof blocks_functions_insertBlock;
  "blocks/functions/removeBlockIfNotNeeded": typeof blocks_functions_removeBlockIfNotNeeded;
  "blocks/functions/saveTopLevelBlocksForNote": typeof blocks_functions_saveTopLevelBlocksForNote;
  "blocks/functions/updateBlock": typeof blocks_functions_updateBlock;
  "blocks/queries": typeof blocks_queries;
  "blocks/types": typeof blocks_types;
  "bookmarks/functions/deleteItemBookmarks": typeof bookmarks_functions_deleteItemBookmarks;
  "bookmarks/functions/getCampaignBookmarks": typeof bookmarks_functions_getCampaignBookmarks;
  "bookmarks/functions/getItemBookmark": typeof bookmarks_functions_getItemBookmark;
  "bookmarks/functions/toggleItemBookmark": typeof bookmarks_functions_toggleItemBookmark;
  "bookmarks/mutations": typeof bookmarks_mutations;
  "bookmarks/types": typeof bookmarks_types;
  "campaigns/constants": typeof campaigns_constants;
  "campaigns/functions/checkCampaignSlugExists": typeof campaigns_functions_checkCampaignSlugExists;
  "campaigns/functions/createCampaign": typeof campaigns_functions_createCampaign;
  "campaigns/functions/deleteCampaign": typeof campaigns_functions_deleteCampaign;
  "campaigns/functions/getCampaign": typeof campaigns_functions_getCampaign;
  "campaigns/functions/getCampaignMembers": typeof campaigns_functions_getCampaignMembers;
  "campaigns/functions/getUserCampaigns": typeof campaigns_functions_getUserCampaigns;
  "campaigns/functions/joinCampaign": typeof campaigns_functions_joinCampaign;
  "campaigns/functions/updateCampaign": typeof campaigns_functions_updateCampaign;
  "campaigns/functions/updateCampaignMemberStatus": typeof campaigns_functions_updateCampaignMemberStatus;
  "campaigns/mutations": typeof campaigns_mutations;
  "campaigns/queries": typeof campaigns_queries;
  "campaigns/types": typeof campaigns_types;
  "campaigns/validation": typeof campaigns_validation;
  "common/constants": typeof common_constants;
  "common/slug": typeof common_slug;
  "common/types": typeof common_types;
  crons: typeof crons;
  "editors/functions/getCurrentEditor": typeof editors_functions_getCurrentEditor;
  "editors/functions/setCurrentEditor": typeof editors_functions_setCurrentEditor;
  "editors/mutations": typeof editors_mutations;
  "editors/queries": typeof editors_queries;
  "editors/types": typeof editors_types;
  email: typeof email;
  errors: typeof errors;
  "files/functions/createFile": typeof files_functions_createFile;
  "files/functions/deleteFile": typeof files_functions_deleteFile;
  "files/functions/enhanceFile": typeof files_functions_enhanceFile;
  "files/functions/getFile": typeof files_functions_getFile;
  "files/functions/updateFile": typeof files_functions_updateFile;
  "files/mutations": typeof files_mutations;
  "files/queries": typeof files_queries;
  "files/types": typeof files_types;
  "folders/baseSchema": typeof folders_baseSchema;
  "folders/functions/createFolder": typeof folders_functions_createFolder;
  "folders/functions/deleteFolder": typeof folders_functions_deleteFolder;
  "folders/functions/enhanceFolder": typeof folders_functions_enhanceFolder;
  "folders/functions/getFolder": typeof folders_functions_getFolder;
  "folders/functions/getFolderContentsForDownload": typeof folders_functions_getFolderContentsForDownload;
  "folders/functions/getSidebarItemAncestors": typeof folders_functions_getSidebarItemAncestors;
  "folders/functions/updateFolder": typeof folders_functions_updateFolder;
  "folders/mutations": typeof folders_mutations;
  "folders/queries": typeof folders_queries;
  "folders/types": typeof folders_types;
  functions: typeof functions;
  "gameMaps/baseSchema": typeof gameMaps_baseSchema;
  "gameMaps/functions/createItemPin": typeof gameMaps_functions_createItemPin;
  "gameMaps/functions/createMap": typeof gameMaps_functions_createMap;
  "gameMaps/functions/deleteMap": typeof gameMaps_functions_deleteMap;
  "gameMaps/functions/enhanceMap": typeof gameMaps_functions_enhanceMap;
  "gameMaps/functions/getMap": typeof gameMaps_functions_getMap;
  "gameMaps/functions/removeItemPin": typeof gameMaps_functions_removeItemPin;
  "gameMaps/functions/updateItemPin": typeof gameMaps_functions_updateItemPin;
  "gameMaps/functions/updateMap": typeof gameMaps_functions_updateMap;
  "gameMaps/functions/updatePinVisibility": typeof gameMaps_functions_updatePinVisibility;
  "gameMaps/mutations": typeof gameMaps_mutations;
  "gameMaps/queries": typeof gameMaps_queries;
  "gameMaps/types": typeof gameMaps_types;
  "gameMaps/validation": typeof gameMaps_validation;
  http: typeof http;
  "notes/editorSpecs": typeof notes_editorSpecs;
  "notes/functions/createNote": typeof notes_functions_createNote;
  "notes/functions/deleteNote": typeof notes_functions_deleteNote;
  "notes/functions/enhanceNote": typeof notes_functions_enhanceNote;
  "notes/functions/getNote": typeof notes_functions_getNote;
  "notes/functions/updateNote": typeof notes_functions_updateNote;
  "notes/functions/updateNoteContent": typeof notes_functions_updateNoteContent;
  "notes/mutations": typeof notes_mutations;
  "notes/queries": typeof notes_queries;
  "notes/types": typeof notes_types;
  "permissions/hasAtLeastPermissionLevel": typeof permissions_hasAtLeastPermissionLevel;
  "permissions/types": typeof permissions_types;
  prosemirrorSync: typeof prosemirrorSync;
  "sessions/functions/endCurrentSession": typeof sessions_functions_endCurrentSession;
  "sessions/functions/getCurrentSession": typeof sessions_functions_getCurrentSession;
  "sessions/functions/getSession": typeof sessions_functions_getSession;
  "sessions/functions/getSessionsByCampaign": typeof sessions_functions_getSessionsByCampaign;
  "sessions/functions/setCurrentSession": typeof sessions_functions_setCurrentSession;
  "sessions/functions/startSession": typeof sessions_functions_startSession;
  "sessions/functions/updateSession": typeof sessions_functions_updateSession;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "sessions/types": typeof sessions_types;
  "sidebarItems/functions/applyToDependents": typeof sidebarItems_functions_applyToDependents;
  "sidebarItems/functions/applyToTree": typeof sidebarItems_functions_applyToTree;
  "sidebarItems/functions/collectDescendants": typeof sidebarItems_functions_collectDescendants;
  "sidebarItems/functions/defaultItemName": typeof sidebarItems_functions_defaultItemName;
  "sidebarItems/functions/emptyTrashBin": typeof sidebarItems_functions_emptyTrashBin;
  "sidebarItems/functions/enhanceSidebarItem": typeof sidebarItems_functions_enhanceSidebarItem;
  "sidebarItems/functions/fetchCampaignSidebarItems": typeof sidebarItems_functions_fetchCampaignSidebarItems;
  "sidebarItems/functions/getSidebarItemById": typeof sidebarItems_functions_getSidebarItemById;
  "sidebarItems/functions/getSidebarItemBySlug": typeof sidebarItems_functions_getSidebarItemBySlug;
  "sidebarItems/functions/getSidebarItemsByParent": typeof sidebarItems_functions_getSidebarItemsByParent;
  "sidebarItems/functions/hardDeleteItem": typeof sidebarItems_functions_hardDeleteItem;
  "sidebarItems/functions/moveSidebarItem": typeof sidebarItems_functions_moveSidebarItem;
  "sidebarItems/functions/permanentlyDeleteSidebarItem": typeof sidebarItems_functions_permanentlyDeleteSidebarItem;
  "sidebarItems/functions/purgeExpiredTrash": typeof sidebarItems_functions_purgeExpiredTrash;
  "sidebarItems/internalMutations": typeof sidebarItems_internalMutations;
  "sidebarItems/mutations": typeof sidebarItems_mutations;
  "sidebarItems/queries": typeof sidebarItems_queries;
  "sidebarItems/schema/baseFields": typeof sidebarItems_schema_baseFields;
  "sidebarItems/schema/baseValidators": typeof sidebarItems_schema_baseValidators;
  "sidebarItems/schema/contentSchema": typeof sidebarItems_schema_contentSchema;
  "sidebarItems/sharedValidation": typeof sidebarItems_sharedValidation;
  "sidebarItems/types/baseTypes": typeof sidebarItems_types_baseTypes;
  "sidebarItems/types/types": typeof sidebarItems_types_types;
  "sidebarItems/validation": typeof sidebarItems_validation;
  "sidebarShares/functions/getCampaignShares": typeof sidebarShares_functions_getCampaignShares;
  "sidebarShares/functions/getSidebarItemShares": typeof sidebarShares_functions_getSidebarItemShares;
  "sidebarShares/functions/getSidebarItemSharesForItem": typeof sidebarShares_functions_getSidebarItemSharesForItem;
  "sidebarShares/functions/getSidebarItemWithShares": typeof sidebarShares_functions_getSidebarItemWithShares;
  "sidebarShares/functions/setAllPlayersPermission": typeof sidebarShares_functions_setAllPlayersPermission;
  "sidebarShares/functions/setFolderInheritShares": typeof sidebarShares_functions_setFolderInheritShares;
  "sidebarShares/functions/shareSidebarItem": typeof sidebarShares_functions_shareSidebarItem;
  "sidebarShares/functions/sidebarItemPermissions": typeof sidebarShares_functions_sidebarItemPermissions;
  "sidebarShares/functions/sidebarItemShareMutations": typeof sidebarShares_functions_sidebarItemShareMutations;
  "sidebarShares/functions/unshareSidebarItem": typeof sidebarShares_functions_unshareSidebarItem;
  "sidebarShares/mutations": typeof sidebarShares_mutations;
  "sidebarShares/queries": typeof sidebarShares_queries;
  "sidebarShares/types": typeof sidebarShares_types;
  "storage/functions/commitUpload": typeof storage_functions_commitUpload;
  "storage/functions/getDownloadUrl": typeof storage_functions_getDownloadUrl;
  "storage/functions/getStorageMetadata": typeof storage_functions_getStorageMetadata;
  "storage/functions/trackUpload": typeof storage_functions_trackUpload;
  "storage/mutations": typeof storage_mutations;
  "storage/queries": typeof storage_queries;
  "storage/types": typeof storage_types;
  "storage/validation": typeof storage_validation;
  "userPreferences/mutations": typeof userPreferences_mutations;
  "userPreferences/queries": typeof userPreferences_queries;
  "userPreferences/types": typeof userPreferences_types;
  "users/constants": typeof users_constants;
  "users/functions/checkUsernameExists": typeof users_functions_checkUsernameExists;
  "users/functions/getUserProfile": typeof users_functions_getUserProfile;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/types": typeof users_types;
  "users/validation": typeof users_validation;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  prosemirrorSync: {
    lib: {
      deleteDocument: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        null
      >;
      deleteSnapshots: FunctionReference<
        "mutation",
        "internal",
        { afterVersion?: number; beforeVersion?: number; id: string },
        null
      >;
      deleteSteps: FunctionReference<
        "mutation",
        "internal",
        {
          afterVersion?: number;
          beforeTs: number;
          deleteNewerThanLatestSnapshot?: boolean;
          id: string;
        },
        null
      >;
      getSnapshot: FunctionReference<
        "query",
        "internal",
        { id: string; version?: number },
        { content: null } | { content: string; version: number }
      >;
      getSteps: FunctionReference<
        "query",
        "internal",
        { id: string; version: number },
        {
          clientIds: Array<string | number>;
          steps: Array<string>;
          version: number;
        }
      >;
      latestVersion: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | number
      >;
      submitSnapshot: FunctionReference<
        "mutation",
        "internal",
        {
          content: string;
          id: string;
          pruneSnapshots?: boolean;
          version: number;
        },
        null
      >;
      submitSteps: FunctionReference<
        "mutation",
        "internal",
        {
          clientId: string | number;
          id: string;
          steps: Array<string>;
          version: number;
        },
        | {
            clientIds: Array<string | number>;
            status: "needs-rebase";
            steps: Array<string>;
          }
        | { status: "synced" }
      >;
    };
  };
  betterAuth: {
    adapter: {
      create: FunctionReference<
        "mutation",
        "internal",
        {
          input:
            | {
                data: {
                  createdAt: number;
                  displayUsername?: null | string;
                  email: string;
                  emailVerified: boolean;
                  image?: null | string;
                  isAnonymous?: null | boolean;
                  name: string;
                  phoneNumber?: null | string;
                  phoneNumberVerified?: null | boolean;
                  twoFactorEnabled?: null | boolean;
                  updatedAt: number;
                  userId?: null | string;
                  username?: null | string;
                };
                model: "user";
              }
            | {
                data: {
                  createdAt: number;
                  expiresAt: number;
                  ipAddress?: null | string;
                  token: string;
                  updatedAt: number;
                  userAgent?: null | string;
                  userId: string;
                };
                model: "session";
              }
            | {
                data: {
                  accessToken?: null | string;
                  accessTokenExpiresAt?: null | number;
                  accountId: string;
                  createdAt: number;
                  idToken?: null | string;
                  password?: null | string;
                  providerId: string;
                  refreshToken?: null | string;
                  refreshTokenExpiresAt?: null | number;
                  scope?: null | string;
                  updatedAt: number;
                  userId: string;
                };
                model: "account";
              }
            | {
                data: {
                  createdAt: number;
                  expiresAt: number;
                  identifier: string;
                  updatedAt: number;
                  value: string;
                };
                model: "verification";
              }
            | {
                data: { backupCodes: string; secret: string; userId: string };
                model: "twoFactor";
              }
            | {
                data: {
                  clientId?: null | string;
                  clientSecret?: null | string;
                  createdAt?: null | number;
                  disabled?: null | boolean;
                  icon?: null | string;
                  metadata?: null | string;
                  name?: null | string;
                  redirectUrls?: null | string;
                  type?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                model: "oauthApplication";
              }
            | {
                data: {
                  accessToken?: null | string;
                  accessTokenExpiresAt?: null | number;
                  clientId?: null | string;
                  createdAt?: null | number;
                  refreshToken?: null | string;
                  refreshTokenExpiresAt?: null | number;
                  scopes?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                model: "oauthAccessToken";
              }
            | {
                data: {
                  clientId?: null | string;
                  consentGiven?: null | boolean;
                  createdAt?: null | number;
                  scopes?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                model: "oauthConsent";
              }
            | {
                data: {
                  createdAt: number;
                  expiresAt?: null | number;
                  privateKey: string;
                  publicKey: string;
                };
                model: "jwks";
              }
            | {
                data: { count: number; key: string; lastRequest: number };
                model: "rateLimit";
              };
          onCreateHandle?: string;
          select?: Array<string>;
        },
        any
      >;
      deleteMany: FunctionReference<
        "mutation",
        "internal",
        {
          input:
            | {
                model: "user";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "email"
                    | "emailVerified"
                    | "image"
                    | "createdAt"
                    | "updatedAt"
                    | "twoFactorEnabled"
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "phoneNumber"
                    | "phoneNumberVerified"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "session";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "expiresAt"
                    | "token"
                    | "createdAt"
                    | "updatedAt"
                    | "ipAddress"
                    | "userAgent"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "account";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accountId"
                    | "providerId"
                    | "userId"
                    | "accessToken"
                    | "refreshToken"
                    | "idToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "scope"
                    | "password"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "verification";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "identifier"
                    | "value"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "twoFactor";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "secret" | "backupCodes" | "userId" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthApplication";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "icon"
                    | "metadata"
                    | "clientId"
                    | "clientSecret"
                    | "redirectUrls"
                    | "type"
                    | "disabled"
                    | "userId"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthAccessToken";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accessToken"
                    | "refreshToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthConsent";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "consentGiven"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "jwks";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "publicKey"
                    | "privateKey"
                    | "createdAt"
                    | "expiresAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "rateLimit";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              };
          onDeleteHandle?: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      deleteOne: FunctionReference<
        "mutation",
        "internal",
        {
          input:
            | {
                model: "user";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "email"
                    | "emailVerified"
                    | "image"
                    | "createdAt"
                    | "updatedAt"
                    | "twoFactorEnabled"
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "phoneNumber"
                    | "phoneNumberVerified"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "session";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "expiresAt"
                    | "token"
                    | "createdAt"
                    | "updatedAt"
                    | "ipAddress"
                    | "userAgent"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "account";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accountId"
                    | "providerId"
                    | "userId"
                    | "accessToken"
                    | "refreshToken"
                    | "idToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "scope"
                    | "password"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "verification";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "identifier"
                    | "value"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "twoFactor";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "secret" | "backupCodes" | "userId" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthApplication";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "icon"
                    | "metadata"
                    | "clientId"
                    | "clientSecret"
                    | "redirectUrls"
                    | "type"
                    | "disabled"
                    | "userId"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthAccessToken";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accessToken"
                    | "refreshToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthConsent";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "consentGiven"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "jwks";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "publicKey"
                    | "privateKey"
                    | "createdAt"
                    | "expiresAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "rateLimit";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              };
          onDeleteHandle?: string;
        },
        any
      >;
      findMany: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          limit?: number;
          model:
            | "user"
            | "session"
            | "account"
            | "verification"
            | "twoFactor"
            | "oauthApplication"
            | "oauthAccessToken"
            | "oauthConsent"
            | "jwks"
            | "rateLimit";
          offset?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          select?: Array<string>;
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null;
          }>;
        },
        any
      >;
      findOne: FunctionReference<
        "query",
        "internal",
        {
          join?: any;
          model:
            | "user"
            | "session"
            | "account"
            | "verification"
            | "twoFactor"
            | "oauthApplication"
            | "oauthAccessToken"
            | "oauthConsent"
            | "jwks"
            | "rateLimit";
          select?: Array<string>;
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
            operator?:
              | "lt"
              | "lte"
              | "gt"
              | "gte"
              | "eq"
              | "in"
              | "not_in"
              | "ne"
              | "contains"
              | "starts_with"
              | "ends_with";
            value:
              | string
              | number
              | boolean
              | Array<string>
              | Array<number>
              | null;
          }>;
        },
        any
      >;
      updateMany: FunctionReference<
        "mutation",
        "internal",
        {
          input:
            | {
                model: "user";
                update: {
                  createdAt?: number;
                  displayUsername?: null | string;
                  email?: string;
                  emailVerified?: boolean;
                  image?: null | string;
                  isAnonymous?: null | boolean;
                  name?: string;
                  phoneNumber?: null | string;
                  phoneNumberVerified?: null | boolean;
                  twoFactorEnabled?: null | boolean;
                  updatedAt?: number;
                  userId?: null | string;
                  username?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "email"
                    | "emailVerified"
                    | "image"
                    | "createdAt"
                    | "updatedAt"
                    | "twoFactorEnabled"
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "phoneNumber"
                    | "phoneNumberVerified"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "session";
                update: {
                  createdAt?: number;
                  expiresAt?: number;
                  ipAddress?: null | string;
                  token?: string;
                  updatedAt?: number;
                  userAgent?: null | string;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "expiresAt"
                    | "token"
                    | "createdAt"
                    | "updatedAt"
                    | "ipAddress"
                    | "userAgent"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "account";
                update: {
                  accessToken?: null | string;
                  accessTokenExpiresAt?: null | number;
                  accountId?: string;
                  createdAt?: number;
                  idToken?: null | string;
                  password?: null | string;
                  providerId?: string;
                  refreshToken?: null | string;
                  refreshTokenExpiresAt?: null | number;
                  scope?: null | string;
                  updatedAt?: number;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accountId"
                    | "providerId"
                    | "userId"
                    | "accessToken"
                    | "refreshToken"
                    | "idToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "scope"
                    | "password"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "verification";
                update: {
                  createdAt?: number;
                  expiresAt?: number;
                  identifier?: string;
                  updatedAt?: number;
                  value?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "identifier"
                    | "value"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "twoFactor";
                update: {
                  backupCodes?: string;
                  secret?: string;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "secret" | "backupCodes" | "userId" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthApplication";
                update: {
                  clientId?: null | string;
                  clientSecret?: null | string;
                  createdAt?: null | number;
                  disabled?: null | boolean;
                  icon?: null | string;
                  metadata?: null | string;
                  name?: null | string;
                  redirectUrls?: null | string;
                  type?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "icon"
                    | "metadata"
                    | "clientId"
                    | "clientSecret"
                    | "redirectUrls"
                    | "type"
                    | "disabled"
                    | "userId"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthAccessToken";
                update: {
                  accessToken?: null | string;
                  accessTokenExpiresAt?: null | number;
                  clientId?: null | string;
                  createdAt?: null | number;
                  refreshToken?: null | string;
                  refreshTokenExpiresAt?: null | number;
                  scopes?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accessToken"
                    | "refreshToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthConsent";
                update: {
                  clientId?: null | string;
                  consentGiven?: null | boolean;
                  createdAt?: null | number;
                  scopes?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "consentGiven"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "jwks";
                update: {
                  createdAt?: number;
                  expiresAt?: null | number;
                  privateKey?: string;
                  publicKey?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "publicKey"
                    | "privateKey"
                    | "createdAt"
                    | "expiresAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "rateLimit";
                update: { count?: number; key?: string; lastRequest?: number };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              };
          onUpdateHandle?: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        any
      >;
      updateOne: FunctionReference<
        "mutation",
        "internal",
        {
          input:
            | {
                model: "user";
                update: {
                  createdAt?: number;
                  displayUsername?: null | string;
                  email?: string;
                  emailVerified?: boolean;
                  image?: null | string;
                  isAnonymous?: null | boolean;
                  name?: string;
                  phoneNumber?: null | string;
                  phoneNumberVerified?: null | boolean;
                  twoFactorEnabled?: null | boolean;
                  updatedAt?: number;
                  userId?: null | string;
                  username?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "email"
                    | "emailVerified"
                    | "image"
                    | "createdAt"
                    | "updatedAt"
                    | "twoFactorEnabled"
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "phoneNumber"
                    | "phoneNumberVerified"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "session";
                update: {
                  createdAt?: number;
                  expiresAt?: number;
                  ipAddress?: null | string;
                  token?: string;
                  updatedAt?: number;
                  userAgent?: null | string;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "expiresAt"
                    | "token"
                    | "createdAt"
                    | "updatedAt"
                    | "ipAddress"
                    | "userAgent"
                    | "userId"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "account";
                update: {
                  accessToken?: null | string;
                  accessTokenExpiresAt?: null | number;
                  accountId?: string;
                  createdAt?: number;
                  idToken?: null | string;
                  password?: null | string;
                  providerId?: string;
                  refreshToken?: null | string;
                  refreshTokenExpiresAt?: null | number;
                  scope?: null | string;
                  updatedAt?: number;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accountId"
                    | "providerId"
                    | "userId"
                    | "accessToken"
                    | "refreshToken"
                    | "idToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "scope"
                    | "password"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "verification";
                update: {
                  createdAt?: number;
                  expiresAt?: number;
                  identifier?: string;
                  updatedAt?: number;
                  value?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "identifier"
                    | "value"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "twoFactor";
                update: {
                  backupCodes?: string;
                  secret?: string;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "secret" | "backupCodes" | "userId" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthApplication";
                update: {
                  clientId?: null | string;
                  clientSecret?: null | string;
                  createdAt?: null | number;
                  disabled?: null | boolean;
                  icon?: null | string;
                  metadata?: null | string;
                  name?: null | string;
                  redirectUrls?: null | string;
                  type?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "icon"
                    | "metadata"
                    | "clientId"
                    | "clientSecret"
                    | "redirectUrls"
                    | "type"
                    | "disabled"
                    | "userId"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthAccessToken";
                update: {
                  accessToken?: null | string;
                  accessTokenExpiresAt?: null | number;
                  clientId?: null | string;
                  createdAt?: null | number;
                  refreshToken?: null | string;
                  refreshTokenExpiresAt?: null | number;
                  scopes?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "accessToken"
                    | "refreshToken"
                    | "accessTokenExpiresAt"
                    | "refreshTokenExpiresAt"
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "oauthConsent";
                update: {
                  clientId?: null | string;
                  consentGiven?: null | boolean;
                  createdAt?: null | number;
                  scopes?: null | string;
                  updatedAt?: null | number;
                  userId?: null | string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "clientId"
                    | "userId"
                    | "scopes"
                    | "createdAt"
                    | "updatedAt"
                    | "consentGiven"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "jwks";
                update: {
                  createdAt?: number;
                  expiresAt?: null | number;
                  privateKey?: string;
                  publicKey?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "publicKey"
                    | "privateKey"
                    | "createdAt"
                    | "expiresAt"
                    | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              }
            | {
                model: "rateLimit";
                update: { count?: number; key?: string; lastRequest?: number };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
                  operator?:
                    | "lt"
                    | "lte"
                    | "gt"
                    | "gte"
                    | "eq"
                    | "in"
                    | "not_in"
                    | "ne"
                    | "contains"
                    | "starts_with"
                    | "ends_with";
                  value:
                    | string
                    | number
                    | boolean
                    | Array<string>
                    | Array<number>
                    | null;
                }>;
              };
          onUpdateHandle?: string;
        },
        any
      >;
    };
    adapterTest: {
      runCustomTests: FunctionReference<"action", "internal", any, any>;
      runTests: FunctionReference<"action", "internal", any, any>;
    };
    testProfiles: {
      adapterAdditionalFields: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email: string;
                    emailVerified: boolean;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    ipAddress?: null | string;
                    token: string;
                    updatedAt: number;
                    userAgent?: null | string;
                    userId: string;
                  };
                  model: "session";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId: string;
                    createdAt: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt: number;
                    userId: string;
                  };
                  model: "account";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    identifier: string;
                    updatedAt: number;
                    value: string;
                  };
                  model: "verification";
                }
              | {
                  data: { backupCodes: string; secret: string; userId: string };
                  model: "twoFactor";
                }
              | {
                  data: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthApplication";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthAccessToken";
                }
              | {
                  data: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthConsent";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt?: null | number;
                    privateKey: string;
                    publicKey: string;
                  };
                  model: "jwks";
                }
              | {
                  data: { count: number; key: string; lastRequest: number };
                  model: "rateLimit";
                };
            onCreateHandle?: string;
            select?: Array<string>;
          },
          any
        >;
        deleteMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "customField"
                      | "numericField"
                      | "testField"
                      | "cbDefaultValueField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        deleteOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "customField"
                      | "numericField"
                      | "testField"
                      | "cbDefaultValueField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
          },
          any
        >;
        findMany: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            limit?: number;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit";
            offset?: number;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            select?: Array<string>;
            sortBy?: { direction: "asc" | "desc"; field: string };
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        findOne: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit";
            select?: Array<string>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        updateMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: string;
                    emailVerified?: boolean;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "customField"
                      | "numericField"
                      | "testField"
                      | "cbDefaultValueField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        updateOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: string;
                    emailVerified?: boolean;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "customField"
                      | "numericField"
                      | "testField"
                      | "cbDefaultValueField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
          },
          any
        >;
      };
      adapterOrganizationJoins: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    ipAddress?: null | string;
                    token: string;
                    updatedAt: number;
                    userAgent?: null | string;
                    userId: string;
                  };
                  model: "session";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId: string;
                    createdAt: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt: number;
                    userId: string;
                  };
                  model: "account";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    identifier: string;
                    updatedAt: number;
                    value: string;
                  };
                  model: "verification";
                }
              | {
                  data: { backupCodes: string; secret: string; userId: string };
                  model: "twoFactor";
                }
              | {
                  data: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthApplication";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthAccessToken";
                }
              | {
                  data: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthConsent";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt?: null | number;
                    privateKey: string;
                    publicKey: string;
                  };
                  model: "jwks";
                }
              | {
                  data: { count: number; key: string; lastRequest: number };
                  model: "rateLimit";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_custom";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_table";
                }
              | { data: { oneToOne: string }; model: "oneToOneTable" }
              | {
                  data: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  model: "one_to_one_table";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  model: "testModel";
                }
              | {
                  data: {
                    createdAt: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name: string;
                    slug: string;
                    updatedAt?: null | number;
                  };
                  model: "organization";
                }
              | {
                  data: {
                    createdAt: number;
                    organizationId: string;
                    role: string;
                    updatedAt?: null | number;
                    userId: string;
                  };
                  model: "member";
                }
              | {
                  data: {
                    createdAt: number;
                    name: string;
                    organizationId: string;
                    updatedAt?: null | number;
                  };
                  model: "team";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    teamId: string;
                    userId: string;
                  };
                  model: "teamMember";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  model: "invitation";
                };
            onCreateHandle?: string;
            select?: Array<string>;
          },
          any
        >;
        deleteMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        deleteOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
          },
          any
        >;
        findMany: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            limit?: number;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            offset?: number;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            select?: Array<string>;
            sortBy?: { direction: "asc" | "desc"; field: string };
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        findOne: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            select?: Array<string>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        updateMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        updateOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
          },
          any
        >;
      };
      adapterPluginTable: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    ipAddress?: null | string;
                    token: string;
                    updatedAt: number;
                    userAgent?: null | string;
                    userId: string;
                  };
                  model: "session";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId: string;
                    createdAt: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt: number;
                    userId: string;
                  };
                  model: "account";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    identifier: string;
                    updatedAt: number;
                    value: string;
                  };
                  model: "verification";
                }
              | {
                  data: { backupCodes: string; secret: string; userId: string };
                  model: "twoFactor";
                }
              | {
                  data: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthApplication";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthAccessToken";
                }
              | {
                  data: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthConsent";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt?: null | number;
                    privateKey: string;
                    publicKey: string;
                  };
                  model: "jwks";
                }
              | {
                  data: { count: number; key: string; lastRequest: number };
                  model: "rateLimit";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_custom";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_table";
                }
              | { data: { oneToOne: string }; model: "oneToOneTable" }
              | {
                  data: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  model: "one_to_one_table";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  model: "testModel";
                }
              | {
                  data: {
                    createdAt: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name: string;
                    slug: string;
                    updatedAt?: null | number;
                  };
                  model: "organization";
                }
              | {
                  data: {
                    createdAt: number;
                    organizationId: string;
                    role: string;
                    updatedAt?: null | number;
                    userId: string;
                  };
                  model: "member";
                }
              | {
                  data: {
                    createdAt: number;
                    name: string;
                    organizationId: string;
                    updatedAt?: null | number;
                  };
                  model: "team";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    teamId: string;
                    userId: string;
                  };
                  model: "teamMember";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  model: "invitation";
                };
            onCreateHandle?: string;
            select?: Array<string>;
          },
          any
        >;
        deleteMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        deleteOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
          },
          any
        >;
        findMany: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            limit?: number;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            offset?: number;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            select?: Array<string>;
            sortBy?: { direction: "asc" | "desc"; field: string };
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        findOne: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            select?: Array<string>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        updateMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        updateOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
          },
          any
        >;
      };
      adapterRenameField: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    ipAddress?: null | string;
                    token: string;
                    updatedAt: number;
                    userAgent?: null | string;
                    userId: string;
                  };
                  model: "session";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId: string;
                    createdAt: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt: number;
                    userId: string;
                  };
                  model: "account";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    identifier: string;
                    updatedAt: number;
                    value: string;
                  };
                  model: "verification";
                }
              | {
                  data: { backupCodes: string; secret: string; userId: string };
                  model: "twoFactor";
                }
              | {
                  data: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthApplication";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthAccessToken";
                }
              | {
                  data: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthConsent";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt?: null | number;
                    privateKey: string;
                    publicKey: string;
                  };
                  model: "jwks";
                }
              | {
                  data: { count: number; key: string; lastRequest: number };
                  model: "rateLimit";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_custom";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_table";
                }
              | { data: { oneToOne: string }; model: "oneToOneTable" }
              | {
                  data: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  model: "one_to_one_table";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  model: "testModel";
                }
              | {
                  data: {
                    createdAt: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name: string;
                    slug: string;
                    updatedAt?: null | number;
                  };
                  model: "organization";
                }
              | {
                  data: {
                    createdAt: number;
                    organizationId: string;
                    role: string;
                    updatedAt?: null | number;
                    userId: string;
                  };
                  model: "member";
                }
              | {
                  data: {
                    createdAt: number;
                    name: string;
                    organizationId: string;
                    updatedAt?: null | number;
                  };
                  model: "team";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    teamId: string;
                    userId: string;
                  };
                  model: "teamMember";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  model: "invitation";
                };
            onCreateHandle?: string;
            select?: Array<string>;
          },
          any
        >;
        deleteMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        deleteOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
          },
          any
        >;
        findMany: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            limit?: number;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            offset?: number;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            select?: Array<string>;
            sortBy?: { direction: "asc" | "desc"; field: string };
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        findOne: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            select?: Array<string>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        updateMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        updateOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
          },
          any
        >;
      };
      adapterRenameUserCustom: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    ipAddress?: null | string;
                    token: string;
                    updatedAt: number;
                    userAgent?: null | string;
                    userId: string;
                  };
                  model: "session";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId: string;
                    createdAt: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt: number;
                    userId: string;
                  };
                  model: "account";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    identifier: string;
                    updatedAt: number;
                    value: string;
                  };
                  model: "verification";
                }
              | {
                  data: { backupCodes: string; secret: string; userId: string };
                  model: "twoFactor";
                }
              | {
                  data: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthApplication";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthAccessToken";
                }
              | {
                  data: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthConsent";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt?: null | number;
                    privateKey: string;
                    publicKey: string;
                  };
                  model: "jwks";
                }
              | {
                  data: { count: number; key: string; lastRequest: number };
                  model: "rateLimit";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_custom";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_table";
                }
              | { data: { oneToOne: string }; model: "oneToOneTable" }
              | {
                  data: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  model: "one_to_one_table";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  model: "testModel";
                }
              | {
                  data: {
                    createdAt: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name: string;
                    slug: string;
                    updatedAt?: null | number;
                  };
                  model: "organization";
                }
              | {
                  data: {
                    createdAt: number;
                    organizationId: string;
                    role: string;
                    updatedAt?: null | number;
                    userId: string;
                  };
                  model: "member";
                }
              | {
                  data: {
                    createdAt: number;
                    name: string;
                    organizationId: string;
                    updatedAt?: null | number;
                  };
                  model: "team";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    teamId: string;
                    userId: string;
                  };
                  model: "teamMember";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  model: "invitation";
                };
            onCreateHandle?: string;
            select?: Array<string>;
          },
          any
        >;
        deleteMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        deleteOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
          },
          any
        >;
        findMany: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            limit?: number;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            offset?: number;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            select?: Array<string>;
            sortBy?: { direction: "asc" | "desc"; field: string };
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        findOne: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            select?: Array<string>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        updateMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        updateOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
          },
          any
        >;
      };
      adapterRenameUserTable: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    ipAddress?: null | string;
                    token: string;
                    updatedAt: number;
                    userAgent?: null | string;
                    userId: string;
                  };
                  model: "session";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId: string;
                    createdAt: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt: number;
                    userId: string;
                  };
                  model: "account";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt: number;
                    identifier: string;
                    updatedAt: number;
                    value: string;
                  };
                  model: "verification";
                }
              | {
                  data: { backupCodes: string; secret: string; userId: string };
                  model: "twoFactor";
                }
              | {
                  data: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthApplication";
                }
              | {
                  data: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthAccessToken";
                }
              | {
                  data: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  model: "oauthConsent";
                }
              | {
                  data: {
                    createdAt: number;
                    expiresAt?: null | number;
                    privateKey: string;
                    publicKey: string;
                  };
                  model: "jwks";
                }
              | {
                  data: { count: number; key: string; lastRequest: number };
                  model: "rateLimit";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_custom";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    createdAt: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  model: "user_table";
                }
              | { data: { oneToOne: string }; model: "oneToOneTable" }
              | {
                  data: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  model: "one_to_one_table";
                }
              | {
                  data: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  model: "testModel";
                }
              | {
                  data: {
                    createdAt: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name: string;
                    slug: string;
                    updatedAt?: null | number;
                  };
                  model: "organization";
                }
              | {
                  data: {
                    createdAt: number;
                    organizationId: string;
                    role: string;
                    updatedAt?: null | number;
                    userId: string;
                  };
                  model: "member";
                }
              | {
                  data: {
                    createdAt: number;
                    name: string;
                    organizationId: string;
                    updatedAt?: null | number;
                  };
                  model: "team";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    teamId: string;
                    userId: string;
                  };
                  model: "teamMember";
                }
              | {
                  data: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  model: "invitation";
                };
            onCreateHandle?: string;
            select?: Array<string>;
          },
          any
        >;
        deleteMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        deleteOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onDeleteHandle?: string;
          },
          any
        >;
        findMany: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            limit?: number;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            offset?: number;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
            select?: Array<string>;
            sortBy?: { direction: "asc" | "desc"; field: string };
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        findOne: FunctionReference<
          "query",
          "internal",
          {
            join?: any;
            model:
              | "user"
              | "session"
              | "account"
              | "verification"
              | "twoFactor"
              | "oauthApplication"
              | "oauthAccessToken"
              | "oauthConsent"
              | "jwks"
              | "rateLimit"
              | "user_custom"
              | "user_table"
              | "oneToOneTable"
              | "one_to_one_table"
              | "testModel"
              | "organization"
              | "member"
              | "team"
              | "teamMember"
              | "invitation";
            select?: Array<string>;
            where?: Array<{
              connector?: "AND" | "OR";
              field: string;
              operator?:
                | "lt"
                | "lte"
                | "gt"
                | "gte"
                | "eq"
                | "in"
                | "not_in"
                | "ne"
                | "contains"
                | "starts_with"
                | "ends_with";
              value:
                | string
                | number
                | boolean
                | Array<string>
                | Array<number>
                | null;
            }>;
          },
          any
        >;
        updateMany: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
            paginationOpts: {
              cursor: string | null;
              endCursor?: string | null;
              id?: number;
              maximumBytesRead?: number;
              maximumRowsRead?: number;
              numItems: number;
            };
          },
          any
        >;
        updateOne: FunctionReference<
          "mutation",
          "internal",
          {
            input:
              | {
                  model: "user";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "session";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    ipAddress?: null | string;
                    token?: string;
                    updatedAt?: number;
                    userAgent?: null | string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "expiresAt"
                      | "token"
                      | "createdAt"
                      | "updatedAt"
                      | "ipAddress"
                      | "userAgent"
                      | "userId"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "account";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    accountId?: string;
                    createdAt?: number;
                    idToken?: null | string;
                    password?: null | string;
                    providerId?: string;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scope?: null | string;
                    updatedAt?: number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accountId"
                      | "providerId"
                      | "userId"
                      | "accessToken"
                      | "refreshToken"
                      | "idToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "scope"
                      | "password"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "verification";
                  update: {
                    createdAt?: number;
                    expiresAt?: number;
                    identifier?: string;
                    updatedAt?: number;
                    value?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "identifier"
                      | "value"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "twoFactor";
                  update: {
                    backupCodes?: string;
                    secret?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "secret" | "backupCodes" | "userId" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthApplication";
                  update: {
                    clientId?: null | string;
                    clientSecret?: null | string;
                    createdAt?: null | number;
                    disabled?: null | boolean;
                    icon?: null | string;
                    metadata?: null | string;
                    name?: null | string;
                    redirectUrls?: null | string;
                    type?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "icon"
                      | "metadata"
                      | "clientId"
                      | "clientSecret"
                      | "redirectUrls"
                      | "type"
                      | "disabled"
                      | "userId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthAccessToken";
                  update: {
                    accessToken?: null | string;
                    accessTokenExpiresAt?: null | number;
                    clientId?: null | string;
                    createdAt?: null | number;
                    refreshToken?: null | string;
                    refreshTokenExpiresAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "accessToken"
                      | "refreshToken"
                      | "accessTokenExpiresAt"
                      | "refreshTokenExpiresAt"
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oauthConsent";
                  update: {
                    clientId?: null | string;
                    consentGiven?: null | boolean;
                    createdAt?: null | number;
                    scopes?: null | string;
                    updatedAt?: null | number;
                    userId?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "clientId"
                      | "userId"
                      | "scopes"
                      | "createdAt"
                      | "updatedAt"
                      | "consentGiven"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "jwks";
                  update: {
                    createdAt?: number;
                    expiresAt?: null | number;
                    privateKey?: string;
                    publicKey?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "publicKey"
                      | "privateKey"
                      | "createdAt"
                      | "expiresAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "rateLimit";
                  update: {
                    count?: number;
                    key?: string;
                    lastRequest?: number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "key" | "count" | "lastRequest" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_custom";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "user_table";
                  update: {
                    cbDefaultValueField?: null | string;
                    createdAt?: number;
                    customField?: null | string;
                    dateField?: null | number;
                    displayUsername?: null | string;
                    email?: null | string;
                    emailVerified?: boolean;
                    email_address?: null | string;
                    image?: null | string;
                    isAnonymous?: null | boolean;
                    name?: string;
                    numericField?: null | number;
                    phoneNumber?: null | string;
                    phoneNumberVerified?: null | boolean;
                    testField?: null | string;
                    twoFactorEnabled?: null | boolean;
                    updatedAt?: number;
                    userId?: null | string;
                    username?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "email"
                      | "email_address"
                      | "emailVerified"
                      | "image"
                      | "createdAt"
                      | "updatedAt"
                      | "twoFactorEnabled"
                      | "isAnonymous"
                      | "username"
                      | "displayUsername"
                      | "phoneNumber"
                      | "phoneNumberVerified"
                      | "userId"
                      | "testField"
                      | "cbDefaultValueField"
                      | "customField"
                      | "numericField"
                      | "dateField"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "oneToOneTable";
                  update: { oneToOne?: string };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "one_to_one_table";
                  update: {
                    oneToOne?: null | string;
                    one_to_one?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "oneToOne" | "one_to_one" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "testModel";
                  update: {
                    cbDefaultValueField?: null | string;
                    json?: any;
                    nullableReference?: null | string;
                    numberArray?: null | Array<number>;
                    stringArray?: null | Array<string>;
                    testField?: null | string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "nullableReference"
                      | "testField"
                      | "cbDefaultValueField"
                      | "stringArray"
                      | "numberArray"
                      | "json"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "organization";
                  update: {
                    createdAt?: number;
                    logo?: null | string;
                    metadata?: null | string;
                    name?: string;
                    slug?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "slug"
                      | "logo"
                      | "metadata"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "member";
                  update: {
                    createdAt?: number;
                    organizationId?: string;
                    role?: string;
                    updatedAt?: null | number;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "organizationId"
                      | "userId"
                      | "role"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "team";
                  update: {
                    createdAt?: number;
                    name?: string;
                    organizationId?: string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "name"
                      | "organizationId"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "teamMember";
                  update: {
                    createdAt?: null | number;
                    teamId?: string;
                    userId?: string;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field: "teamId" | "userId" | "createdAt" | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                }
              | {
                  model: "invitation";
                  update: {
                    createdAt?: null | number;
                    email?: null | string;
                    expiresAt?: null | number;
                    inviterId?: null | string;
                    organizationId?: null | string;
                    role?: null | string;
                    status?: null | string;
                    teamId?: null | string;
                    updatedAt?: null | number;
                  };
                  where?: Array<{
                    connector?: "AND" | "OR";
                    field:
                      | "email"
                      | "role"
                      | "status"
                      | "organizationId"
                      | "teamId"
                      | "inviterId"
                      | "expiresAt"
                      | "createdAt"
                      | "updatedAt"
                      | "_id";
                    operator?:
                      | "lt"
                      | "lte"
                      | "gt"
                      | "gte"
                      | "eq"
                      | "in"
                      | "not_in"
                      | "ne"
                      | "contains"
                      | "starts_with"
                      | "ends_with";
                    value:
                      | string
                      | number
                      | boolean
                      | Array<string>
                      | Array<number>
                      | null;
                  }>;
                };
            onUpdateHandle?: string;
          },
          any
        >;
      };
    };
  };
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: Array<string> | string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bcc?: Array<string>;
          bounced?: boolean;
          cc?: Array<string>;
          clicked?: boolean;
          complained: boolean;
          createdAt: number;
          deliveryDelayed?: boolean;
          errorMessage?: string;
          failed?: boolean;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bounced: boolean;
          clicked: boolean;
          complained: boolean;
          deliveryDelayed: boolean;
          errorMessage: string | null;
          failed: boolean;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          bcc?: Array<string>;
          cc?: Array<string>;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
};
