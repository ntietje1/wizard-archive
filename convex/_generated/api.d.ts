/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth__createAuth from "../auth/_createAuth.js";
import type * as auth_authBaseUrl from "../auth/authBaseUrl.js";
import type * as auth_component from "../auth/component.js";
import type * as auth_componentClient from "../auth/componentClient.js";
import type * as auth_functions_onCreateUser from "../auth/functions/onCreateUser.js";
import type * as auth_functions_onDeleteUser from "../auth/functions/onDeleteUser.js";
import type * as auth_functions_onUpdateUser from "../auth/functions/onUpdateUser.js";
import type * as auth_functions_purgeExpiredAuthData from "../auth/functions/purgeExpiredAuthData.js";
import type * as auth_httpActions from "../auth/httpActions.js";
import type * as auth_identity from "../auth/identity.js";
import type * as auth_internalMutations from "../auth/internalMutations.js";
import type * as auth_routes from "../auth/routes.js";
import type * as campaigns_constants from "../campaigns/constants.js";
import type * as campaigns_functions_acceptedPlayerMember from "../campaigns/functions/acceptedPlayerMember.js";
import type * as campaigns_functions_campaignIdentity from "../campaigns/functions/campaignIdentity.js";
import type * as campaigns_functions_campaignMemberProfiles from "../campaigns/functions/campaignMemberProfiles.js";
import type * as campaigns_functions_campaignMemberProjection from "../campaigns/functions/campaignMemberProjection.js";
import type * as campaigns_functions_createCampaign from "../campaigns/functions/createCampaign.js";
import type * as campaigns_functions_getCampaign from "../campaigns/functions/getCampaign.js";
import type * as campaigns_functions_getCampaignMembers from "../campaigns/functions/getCampaignMembers.js";
import type * as campaigns_functions_getCampaignRequests from "../campaigns/functions/getCampaignRequests.js";
import type * as campaigns_functions_getUserCampaigns from "../campaigns/functions/getUserCampaigns.js";
import type * as campaigns_functions_joinCampaign from "../campaigns/functions/joinCampaign.js";
import type * as campaigns_functions_lifecycle from "../campaigns/functions/lifecycle.js";
import type * as campaigns_functions_updateCampaign from "../campaigns/functions/updateCampaign.js";
import type * as campaigns_functions_updateCampaignMemberStatus from "../campaigns/functions/updateCampaignMemberStatus.js";
import type * as campaigns_internalMutations from "../campaigns/internalMutations.js";
import type * as campaigns_internalQueries from "../campaigns/internalQueries.js";
import type * as campaigns_mutations from "../campaigns/mutations.js";
import type * as campaigns_queries from "../campaigns/queries.js";
import type * as campaigns_rows from "../campaigns/rows.js";
import type * as campaigns_validation from "../campaigns/validation.js";
import type * as common_logger from "../common/logger.js";
import type * as common_pagination from "../common/pagination.js";
import type * as common_types from "../common/types.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emailHttpActions from "../emailHttpActions.js";
import type * as errors from "../errors.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as httpBridge from "../httpBridge.js";
import type * as migrations from "../migrations.js";
import type * as resources_actions from "../resources/actions.js";
import type * as resources_fileUpload from "../resources/fileUpload.js";
import type * as resources_functions_ConvexResourceCatalog from "../resources/functions/ConvexResourceCatalog.js";
import type * as resources_functions_accessOperation from "../resources/functions/accessOperation.js";
import type * as resources_functions_assetContent from "../resources/functions/assetContent.js";
import type * as resources_functions_assetContentState from "../resources/functions/assetContentState.js";
import type * as resources_functions_authorizeResourceContent from "../resources/functions/authorizeResourceContent.js";
import type * as resources_functions_campaignPlayer from "../resources/functions/campaignPlayer.js";
import type * as resources_functions_canvasContent from "../resources/functions/canvasContent.js";
import type * as resources_functions_contentCopyTypes from "../resources/functions/contentCopyTypes.js";
import type * as resources_functions_contentVersion from "../resources/functions/contentVersion.js";
import type * as resources_functions_ensureResourceAssetsFolder from "../resources/functions/ensureResourceAssetsFolder.js";
import type * as resources_functions_executeBookmarkCommand from "../resources/functions/executeBookmarkCommand.js";
import type * as resources_functions_executeMapContentCommand from "../resources/functions/executeMapContentCommand.js";
import type * as resources_functions_executeNoteBlockAccessCommand from "../resources/functions/executeNoteBlockAccessCommand.js";
import type * as resources_functions_executeResourceAccessCommand from "../resources/functions/executeResourceAccessCommand.js";
import type * as resources_functions_executeStructureCommand from "../resources/functions/executeStructureCommand.js";
import type * as resources_functions_fileContent from "../resources/functions/fileContent.js";
import type * as resources_functions_findCanonicalResource from "../resources/functions/findCanonicalResource.js";
import type * as resources_functions_findItemHistoryCheckpoint from "../resources/functions/findItemHistoryCheckpoint.js";
import type * as resources_functions_itemHistory from "../resources/functions/itemHistory.js";
import type * as resources_functions_itemHistoryCleanup from "../resources/functions/itemHistoryCleanup.js";
import type * as resources_functions_itemHistoryQueries from "../resources/functions/itemHistoryQueries.js";
import type * as resources_functions_itemHistoryStructure from "../resources/functions/itemHistoryStructure.js";
import type * as resources_functions_loadFileDownload from "../resources/functions/loadFileDownload.js";
import type * as resources_functions_loadMapImage from "../resources/functions/loadMapImage.js";
import type * as resources_functions_loadNoteContent from "../resources/functions/loadNoteContent.js";
import type * as resources_functions_mapContent from "../resources/functions/mapContent.js";
import type * as resources_functions_noteBlockAccess from "../resources/functions/noteBlockAccess.js";
import type * as resources_functions_noteBlockAccessCleanup from "../resources/functions/noteBlockAccessCleanup.js";
import type * as resources_functions_noteContent from "../resources/functions/noteContent.js";
import type * as resources_functions_plainTransfer from "../resources/functions/plainTransfer.js";
import type * as resources_functions_projectAuthorizedResources from "../resources/functions/projectAuthorizedResources.js";
import type * as resources_functions_projectResourceReferences from "../resources/functions/projectResourceReferences.js";
import type * as resources_functions_replaceCanvasContent from "../resources/functions/replaceCanvasContent.js";
import type * as resources_functions_replaceMapContent from "../resources/functions/replaceMapContent.js";
import type * as resources_functions_replaceMapImage from "../resources/functions/replaceMapImage.js";
import type * as resources_functions_replaceNoteContent from "../resources/functions/replaceNoteContent.js";
import type * as resources_functions_replacementTarget from "../resources/functions/replacementTarget.js";
import type * as resources_functions_resourceAccess from "../resources/functions/resourceAccess.js";
import type * as resources_functions_resourceBookmarks from "../resources/functions/resourceBookmarks.js";
import type * as resources_functions_resourceCatalogMetadata from "../resources/functions/resourceCatalogMetadata.js";
import type * as resources_functions_resourceContentCopy from "../resources/functions/resourceContentCopy.js";
import type * as resources_functions_resourceDeletion from "../resources/functions/resourceDeletion.js";
import type * as resources_functions_resourcePresence from "../resources/functions/resourcePresence.js";
import type * as resources_functions_resourcePreview from "../resources/functions/resourcePreview.js";
import type * as resources_functions_resourceRecordRow from "../resources/functions/resourceRecordRow.js";
import type * as resources_functions_resourceReferences from "../resources/functions/resourceReferences.js";
import type * as resources_functions_resourceSearchProjection from "../resources/functions/resourceSearchProjection.js";
import type * as resources_functions_saveCanvasContent from "../resources/functions/saveCanvasContent.js";
import type * as resources_functions_saveNoteContent from "../resources/functions/saveNoteContent.js";
import type * as resources_functions_searchResources from "../resources/functions/searchResources.js";
import type * as resources_integrity from "../resources/integrity.js";
import type * as resources_internalActions from "../resources/internalActions.js";
import type * as resources_internalMutations from "../resources/internalMutations.js";
import type * as resources_mutations from "../resources/mutations.js";
import type * as resources_queries from "../resources/queries.js";
import type * as resources_validators from "../resources/validators.js";
import type * as sessions_functions_endCurrentSession from "../sessions/functions/endCurrentSession.js";
import type * as sessions_functions_getCurrentSession from "../sessions/functions/getCurrentSession.js";
import type * as sessions_functions_getSession from "../sessions/functions/getSession.js";
import type * as sessions_functions_getSessionsByCampaign from "../sessions/functions/getSessionsByCampaign.js";
import type * as sessions_functions_setCurrentSession from "../sessions/functions/setCurrentSession.js";
import type * as sessions_functions_startSession from "../sessions/functions/startSession.js";
import type * as sessions_functions_updateSession from "../sessions/functions/updateSession.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as storage_functions_assetIdentity from "../storage/functions/assetIdentity.js";
import type * as storage_functions_bindUpload from "../storage/functions/bindUpload.js";
import type * as storage_functions_commitUpload from "../storage/functions/commitUpload.js";
import type * as storage_functions_createUploadSession from "../storage/functions/createUploadSession.js";
import type * as storage_functions_discardUpload from "../storage/functions/discardUpload.js";
import type * as storage_functions_getStorageMetadata from "../storage/functions/getStorageMetadata.js";
import type * as storage_functions_getUserFileStorage from "../storage/functions/getUserFileStorage.js";
import type * as storage_functions_getUserUploadSession from "../storage/functions/getUserUploadSession.js";
import type * as storage_functions_storageReferences from "../storage/functions/storageReferences.js";
import type * as storage_mutations from "../storage/mutations.js";
import type * as storage_queries from "../storage/queries.js";
import type * as storage_types from "../storage/types.js";
import type * as triggers from "../triggers.js";
import type * as userPreferences_mutations from "../userPreferences/mutations.js";
import type * as userPreferences_queries from "../userPreferences/queries.js";
import type * as userPreferences_types from "../userPreferences/types.js";
import type * as users_authTypes from "../users/authTypes.js";
import type * as users_constants from "../users/constants.js";
import type * as users_functions_checkUsernameExists from "../users/functions/checkUsernameExists.js";
import type * as users_functions_getUserProfile from "../users/functions/getUserProfile.js";
import type * as users_functions_profileSummary from "../users/functions/profileSummary.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_validation from "../users/validation.js";
import type * as workspacePreferences_functions from "../workspacePreferences/functions.js";
import type * as workspacePreferences_mutations from "../workspacePreferences/mutations.js";
import type * as workspacePreferences_queries from "../workspacePreferences/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/_createAuth": typeof auth__createAuth;
  "auth/authBaseUrl": typeof auth_authBaseUrl;
  "auth/component": typeof auth_component;
  "auth/componentClient": typeof auth_componentClient;
  "auth/functions/onCreateUser": typeof auth_functions_onCreateUser;
  "auth/functions/onDeleteUser": typeof auth_functions_onDeleteUser;
  "auth/functions/onUpdateUser": typeof auth_functions_onUpdateUser;
  "auth/functions/purgeExpiredAuthData": typeof auth_functions_purgeExpiredAuthData;
  "auth/httpActions": typeof auth_httpActions;
  "auth/identity": typeof auth_identity;
  "auth/internalMutations": typeof auth_internalMutations;
  "auth/routes": typeof auth_routes;
  "campaigns/constants": typeof campaigns_constants;
  "campaigns/functions/acceptedPlayerMember": typeof campaigns_functions_acceptedPlayerMember;
  "campaigns/functions/campaignIdentity": typeof campaigns_functions_campaignIdentity;
  "campaigns/functions/campaignMemberProfiles": typeof campaigns_functions_campaignMemberProfiles;
  "campaigns/functions/campaignMemberProjection": typeof campaigns_functions_campaignMemberProjection;
  "campaigns/functions/createCampaign": typeof campaigns_functions_createCampaign;
  "campaigns/functions/getCampaign": typeof campaigns_functions_getCampaign;
  "campaigns/functions/getCampaignMembers": typeof campaigns_functions_getCampaignMembers;
  "campaigns/functions/getCampaignRequests": typeof campaigns_functions_getCampaignRequests;
  "campaigns/functions/getUserCampaigns": typeof campaigns_functions_getUserCampaigns;
  "campaigns/functions/joinCampaign": typeof campaigns_functions_joinCampaign;
  "campaigns/functions/lifecycle": typeof campaigns_functions_lifecycle;
  "campaigns/functions/updateCampaign": typeof campaigns_functions_updateCampaign;
  "campaigns/functions/updateCampaignMemberStatus": typeof campaigns_functions_updateCampaignMemberStatus;
  "campaigns/internalMutations": typeof campaigns_internalMutations;
  "campaigns/internalQueries": typeof campaigns_internalQueries;
  "campaigns/mutations": typeof campaigns_mutations;
  "campaigns/queries": typeof campaigns_queries;
  "campaigns/rows": typeof campaigns_rows;
  "campaigns/validation": typeof campaigns_validation;
  "common/logger": typeof common_logger;
  "common/pagination": typeof common_pagination;
  "common/types": typeof common_types;
  crons: typeof crons;
  email: typeof email;
  emailHttpActions: typeof emailHttpActions;
  errors: typeof errors;
  functions: typeof functions;
  http: typeof http;
  httpBridge: typeof httpBridge;
  migrations: typeof migrations;
  "resources/actions": typeof resources_actions;
  "resources/fileUpload": typeof resources_fileUpload;
  "resources/functions/ConvexResourceCatalog": typeof resources_functions_ConvexResourceCatalog;
  "resources/functions/accessOperation": typeof resources_functions_accessOperation;
  "resources/functions/assetContent": typeof resources_functions_assetContent;
  "resources/functions/assetContentState": typeof resources_functions_assetContentState;
  "resources/functions/authorizeResourceContent": typeof resources_functions_authorizeResourceContent;
  "resources/functions/campaignPlayer": typeof resources_functions_campaignPlayer;
  "resources/functions/canvasContent": typeof resources_functions_canvasContent;
  "resources/functions/contentCopyTypes": typeof resources_functions_contentCopyTypes;
  "resources/functions/contentVersion": typeof resources_functions_contentVersion;
  "resources/functions/ensureResourceAssetsFolder": typeof resources_functions_ensureResourceAssetsFolder;
  "resources/functions/executeBookmarkCommand": typeof resources_functions_executeBookmarkCommand;
  "resources/functions/executeMapContentCommand": typeof resources_functions_executeMapContentCommand;
  "resources/functions/executeNoteBlockAccessCommand": typeof resources_functions_executeNoteBlockAccessCommand;
  "resources/functions/executeResourceAccessCommand": typeof resources_functions_executeResourceAccessCommand;
  "resources/functions/executeStructureCommand": typeof resources_functions_executeStructureCommand;
  "resources/functions/fileContent": typeof resources_functions_fileContent;
  "resources/functions/findCanonicalResource": typeof resources_functions_findCanonicalResource;
  "resources/functions/findItemHistoryCheckpoint": typeof resources_functions_findItemHistoryCheckpoint;
  "resources/functions/itemHistory": typeof resources_functions_itemHistory;
  "resources/functions/itemHistoryCleanup": typeof resources_functions_itemHistoryCleanup;
  "resources/functions/itemHistoryQueries": typeof resources_functions_itemHistoryQueries;
  "resources/functions/itemHistoryStructure": typeof resources_functions_itemHistoryStructure;
  "resources/functions/loadFileDownload": typeof resources_functions_loadFileDownload;
  "resources/functions/loadMapImage": typeof resources_functions_loadMapImage;
  "resources/functions/loadNoteContent": typeof resources_functions_loadNoteContent;
  "resources/functions/mapContent": typeof resources_functions_mapContent;
  "resources/functions/noteBlockAccess": typeof resources_functions_noteBlockAccess;
  "resources/functions/noteBlockAccessCleanup": typeof resources_functions_noteBlockAccessCleanup;
  "resources/functions/noteContent": typeof resources_functions_noteContent;
  "resources/functions/plainTransfer": typeof resources_functions_plainTransfer;
  "resources/functions/projectAuthorizedResources": typeof resources_functions_projectAuthorizedResources;
  "resources/functions/projectResourceReferences": typeof resources_functions_projectResourceReferences;
  "resources/functions/replaceCanvasContent": typeof resources_functions_replaceCanvasContent;
  "resources/functions/replaceMapContent": typeof resources_functions_replaceMapContent;
  "resources/functions/replaceMapImage": typeof resources_functions_replaceMapImage;
  "resources/functions/replaceNoteContent": typeof resources_functions_replaceNoteContent;
  "resources/functions/replacementTarget": typeof resources_functions_replacementTarget;
  "resources/functions/resourceAccess": typeof resources_functions_resourceAccess;
  "resources/functions/resourceBookmarks": typeof resources_functions_resourceBookmarks;
  "resources/functions/resourceCatalogMetadata": typeof resources_functions_resourceCatalogMetadata;
  "resources/functions/resourceContentCopy": typeof resources_functions_resourceContentCopy;
  "resources/functions/resourceDeletion": typeof resources_functions_resourceDeletion;
  "resources/functions/resourcePresence": typeof resources_functions_resourcePresence;
  "resources/functions/resourcePreview": typeof resources_functions_resourcePreview;
  "resources/functions/resourceRecordRow": typeof resources_functions_resourceRecordRow;
  "resources/functions/resourceReferences": typeof resources_functions_resourceReferences;
  "resources/functions/resourceSearchProjection": typeof resources_functions_resourceSearchProjection;
  "resources/functions/saveCanvasContent": typeof resources_functions_saveCanvasContent;
  "resources/functions/saveNoteContent": typeof resources_functions_saveNoteContent;
  "resources/functions/searchResources": typeof resources_functions_searchResources;
  "resources/integrity": typeof resources_integrity;
  "resources/internalActions": typeof resources_internalActions;
  "resources/internalMutations": typeof resources_internalMutations;
  "resources/mutations": typeof resources_mutations;
  "resources/queries": typeof resources_queries;
  "resources/validators": typeof resources_validators;
  "sessions/functions/endCurrentSession": typeof sessions_functions_endCurrentSession;
  "sessions/functions/getCurrentSession": typeof sessions_functions_getCurrentSession;
  "sessions/functions/getSession": typeof sessions_functions_getSession;
  "sessions/functions/getSessionsByCampaign": typeof sessions_functions_getSessionsByCampaign;
  "sessions/functions/setCurrentSession": typeof sessions_functions_setCurrentSession;
  "sessions/functions/startSession": typeof sessions_functions_startSession;
  "sessions/functions/updateSession": typeof sessions_functions_updateSession;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "storage/functions/assetIdentity": typeof storage_functions_assetIdentity;
  "storage/functions/bindUpload": typeof storage_functions_bindUpload;
  "storage/functions/commitUpload": typeof storage_functions_commitUpload;
  "storage/functions/createUploadSession": typeof storage_functions_createUploadSession;
  "storage/functions/discardUpload": typeof storage_functions_discardUpload;
  "storage/functions/getStorageMetadata": typeof storage_functions_getStorageMetadata;
  "storage/functions/getUserFileStorage": typeof storage_functions_getUserFileStorage;
  "storage/functions/getUserUploadSession": typeof storage_functions_getUserUploadSession;
  "storage/functions/storageReferences": typeof storage_functions_storageReferences;
  "storage/mutations": typeof storage_mutations;
  "storage/queries": typeof storage_queries;
  "storage/types": typeof storage_types;
  triggers: typeof triggers;
  "userPreferences/mutations": typeof userPreferences_mutations;
  "userPreferences/queries": typeof userPreferences_queries;
  "userPreferences/types": typeof userPreferences_types;
  "users/authTypes": typeof users_authTypes;
  "users/constants": typeof users_constants;
  "users/functions/checkUsernameExists": typeof users_functions_checkUsernameExists;
  "users/functions/getUserProfile": typeof users_functions_getUserProfile;
  "users/functions/profileSummary": typeof users_functions_profileSummary;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/validation": typeof users_validation;
  "workspacePreferences/functions": typeof workspacePreferences_functions;
  "workspacePreferences/mutations": typeof workspacePreferences_mutations;
  "workspacePreferences/queries": typeof workspacePreferences_queries;
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
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
