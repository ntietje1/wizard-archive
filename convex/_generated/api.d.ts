/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as blocks_blocks from "../blocks/blocks.js";
import type * as blocks_queries from "../blocks/queries.js";
import type * as blocks_types from "../blocks/types.js";
import type * as bookmarks_functions_deleteItemBookmarks from "../bookmarks/functions/deleteItemBookmarks.js";
import type * as bookmarks_functions_getItemBookmark from "../bookmarks/functions/getItemBookmark.js";
import type * as bookmarks_functions_toggleItemBookmark from "../bookmarks/functions/toggleItemBookmark.js";
import type * as bookmarks_mutations from "../bookmarks/mutations.js";
import type * as bookmarks_types from "../bookmarks/types.js";
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
import type * as common_slug from "../common/slug.js";
import type * as common_types from "../common/types.js";
import type * as editors_functions_getCurrentEditor from "../editors/functions/getCurrentEditor.js";
import type * as editors_functions_setCurrentEditor from "../editors/functions/setCurrentEditor.js";
import type * as editors_mutations from "../editors/mutations.js";
import type * as editors_queries from "../editors/queries.js";
import type * as editors_types from "../editors/types.js";
import type * as files_files from "../files/files.js";
import type * as files_helpers from "../files/helpers.js";
import type * as files_mutations from "../files/mutations.js";
import type * as files_queries from "../files/queries.js";
import type * as files_types from "../files/types.js";
import type * as folders_baseSchema from "../folders/baseSchema.js";
import type * as folders_folders from "../folders/folders.js";
import type * as folders_helpers from "../folders/helpers.js";
import type * as folders_mutations from "../folders/mutations.js";
import type * as folders_queries from "../folders/queries.js";
import type * as folders_types from "../folders/types.js";
import type * as functions from "../functions.js";
import type * as gameMaps_baseSchema from "../gameMaps/baseSchema.js";
import type * as gameMaps_gameMaps from "../gameMaps/gameMaps.js";
import type * as gameMaps_helpers from "../gameMaps/helpers.js";
import type * as gameMaps_mutations from "../gameMaps/mutations.js";
import type * as gameMaps_queries from "../gameMaps/queries.js";
import type * as gameMaps_types from "../gameMaps/types.js";
import type * as notes_editorSpecs from "../notes/editorSpecs.js";
import type * as notes_helpers from "../notes/helpers.js";
import type * as notes_mutations from "../notes/mutations.js";
import type * as notes_notes from "../notes/notes.js";
import type * as notes_queries from "../notes/queries.js";
import type * as notes_types from "../notes/types.js";
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
import type * as shares_blockShares from "../shares/blockShares.js";
import type * as shares_itemShares from "../shares/itemShares.js";
import type * as shares_mutations from "../shares/mutations.js";
import type * as shares_queries from "../shares/queries.js";
import type * as shares_shares from "../shares/shares.js";
import type * as shares_types from "../shares/types.js";
import type * as sidebarItems_baseTypes from "../sidebarItems/baseTypes.js";
import type * as sidebarItems_enhanceBase from "../sidebarItems/enhanceBase.js";
import type * as sidebarItems_helpers from "../sidebarItems/helpers.js";
import type * as sidebarItems_mutations from "../sidebarItems/mutations.js";
import type * as sidebarItems_queries from "../sidebarItems/queries.js";
import type * as sidebarItems_schema_baseFields from "../sidebarItems/schema/baseFields.js";
import type * as sidebarItems_schema_baseValidators from "../sidebarItems/schema/baseValidators.js";
import type * as sidebarItems_schema_contentSchema from "../sidebarItems/schema/contentSchema.js";
import type * as sidebarItems_sharedValidation from "../sidebarItems/sharedValidation.js";
import type * as sidebarItems_sidebarItems from "../sidebarItems/sidebarItems.js";
import type * as sidebarItems_types from "../sidebarItems/types.js";
import type * as sidebarItems_validation from "../sidebarItems/validation.js";
import type * as storage_functions_commitUpload from "../storage/functions/commitUpload.js";
import type * as storage_functions_getDownloadUrl from "../storage/functions/getDownloadUrl.js";
import type * as storage_functions_getStorageMetadata from "../storage/functions/getStorageMetadata.js";
import type * as storage_functions_trackUpload from "../storage/functions/trackUpload.js";
import type * as storage_mutations from "../storage/mutations.js";
import type * as storage_queries from "../storage/queries.js";
import type * as storage_types from "../storage/types.js";
import type * as storage_validation from "../storage/validation.js";
import type * as users_functions_ensureUserProfile from "../users/functions/ensureUserProfile.js";
import type * as users_functions_getUserProfile from "../users/functions/getUserProfile.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_types from "../users/types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "blocks/blocks": typeof blocks_blocks;
  "blocks/queries": typeof blocks_queries;
  "blocks/types": typeof blocks_types;
  "bookmarks/functions/deleteItemBookmarks": typeof bookmarks_functions_deleteItemBookmarks;
  "bookmarks/functions/getItemBookmark": typeof bookmarks_functions_getItemBookmark;
  "bookmarks/functions/toggleItemBookmark": typeof bookmarks_functions_toggleItemBookmark;
  "bookmarks/mutations": typeof bookmarks_mutations;
  "bookmarks/types": typeof bookmarks_types;
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
  "common/slug": typeof common_slug;
  "common/types": typeof common_types;
  "editors/functions/getCurrentEditor": typeof editors_functions_getCurrentEditor;
  "editors/functions/setCurrentEditor": typeof editors_functions_setCurrentEditor;
  "editors/mutations": typeof editors_mutations;
  "editors/queries": typeof editors_queries;
  "editors/types": typeof editors_types;
  "files/files": typeof files_files;
  "files/helpers": typeof files_helpers;
  "files/mutations": typeof files_mutations;
  "files/queries": typeof files_queries;
  "files/types": typeof files_types;
  "folders/baseSchema": typeof folders_baseSchema;
  "folders/folders": typeof folders_folders;
  "folders/helpers": typeof folders_helpers;
  "folders/mutations": typeof folders_mutations;
  "folders/queries": typeof folders_queries;
  "folders/types": typeof folders_types;
  functions: typeof functions;
  "gameMaps/baseSchema": typeof gameMaps_baseSchema;
  "gameMaps/gameMaps": typeof gameMaps_gameMaps;
  "gameMaps/helpers": typeof gameMaps_helpers;
  "gameMaps/mutations": typeof gameMaps_mutations;
  "gameMaps/queries": typeof gameMaps_queries;
  "gameMaps/types": typeof gameMaps_types;
  "notes/editorSpecs": typeof notes_editorSpecs;
  "notes/helpers": typeof notes_helpers;
  "notes/mutations": typeof notes_mutations;
  "notes/notes": typeof notes_notes;
  "notes/queries": typeof notes_queries;
  "notes/types": typeof notes_types;
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
  "shares/blockShares": typeof shares_blockShares;
  "shares/itemShares": typeof shares_itemShares;
  "shares/mutations": typeof shares_mutations;
  "shares/queries": typeof shares_queries;
  "shares/shares": typeof shares_shares;
  "shares/types": typeof shares_types;
  "sidebarItems/baseTypes": typeof sidebarItems_baseTypes;
  "sidebarItems/enhanceBase": typeof sidebarItems_enhanceBase;
  "sidebarItems/helpers": typeof sidebarItems_helpers;
  "sidebarItems/mutations": typeof sidebarItems_mutations;
  "sidebarItems/queries": typeof sidebarItems_queries;
  "sidebarItems/schema/baseFields": typeof sidebarItems_schema_baseFields;
  "sidebarItems/schema/baseValidators": typeof sidebarItems_schema_baseValidators;
  "sidebarItems/schema/contentSchema": typeof sidebarItems_schema_contentSchema;
  "sidebarItems/sharedValidation": typeof sidebarItems_sharedValidation;
  "sidebarItems/sidebarItems": typeof sidebarItems_sidebarItems;
  "sidebarItems/types": typeof sidebarItems_types;
  "sidebarItems/validation": typeof sidebarItems_validation;
  "storage/functions/commitUpload": typeof storage_functions_commitUpload;
  "storage/functions/getDownloadUrl": typeof storage_functions_getDownloadUrl;
  "storage/functions/getStorageMetadata": typeof storage_functions_getStorageMetadata;
  "storage/functions/trackUpload": typeof storage_functions_trackUpload;
  "storage/mutations": typeof storage_mutations;
  "storage/queries": typeof storage_queries;
  "storage/types": typeof storage_types;
  "storage/validation": typeof storage_validation;
  "users/functions/ensureUserProfile": typeof users_functions_ensureUserProfile;
  "users/functions/getUserProfile": typeof users_functions_getUserProfile;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/types": typeof users_types;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
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
};
