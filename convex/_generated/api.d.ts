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
import type * as campaigns_campaigns from "../campaigns/campaigns.js";
import type * as campaigns_mutations from "../campaigns/mutations.js";
import type * as campaigns_queries from "../campaigns/queries.js";
import type * as campaigns_types from "../campaigns/types.js";
import type * as characters_characters from "../characters/characters.js";
import type * as characters_mutations from "../characters/mutations.js";
import type * as characters_queries from "../characters/queries.js";
import type * as characters_types from "../characters/types.js";
import type * as common_identity from "../common/identity.js";
import type * as common_slug from "../common/slug.js";
import type * as common_types from "../common/types.js";
import type * as editors_mutations from "../editors/mutations.js";
import type * as editors_queries from "../editors/queries.js";
import type * as editors_types from "../editors/types.js";
import type * as files_types from "../files/types.js";
import type * as folders_folders from "../folders/folders.js";
import type * as folders_mutations from "../folders/mutations.js";
import type * as folders_queries from "../folders/queries.js";
import type * as folders_types from "../folders/types.js";
import type * as gameMaps_gameMaps from "../gameMaps/gameMaps.js";
import type * as gameMaps_mutations from "../gameMaps/mutations.js";
import type * as gameMaps_queries from "../gameMaps/queries.js";
import type * as gameMaps_types from "../gameMaps/types.js";
import type * as gameMaps_validators from "../gameMaps/validators.js";
import type * as locations_locations from "../locations/locations.js";
import type * as locations_mutations from "../locations/mutations.js";
import type * as locations_queries from "../locations/queries.js";
import type * as locations_types from "../locations/types.js";
import type * as notes_editorSpecs from "../notes/editorSpecs.js";
import type * as notes_mutations from "../notes/mutations.js";
import type * as notes_notes from "../notes/notes.js";
import type * as notes_queries from "../notes/queries.js";
import type * as notes_types from "../notes/types.js";
import type * as sessions_mutations from "../sessions/mutations.js";
import type * as sessions_queries from "../sessions/queries.js";
import type * as sessions_sessions from "../sessions/sessions.js";
import type * as sessions_types from "../sessions/types.js";
import type * as shares_mutations from "../shares/mutations.js";
import type * as shares_queries from "../shares/queries.js";
import type * as shares_shares from "../shares/shares.js";
import type * as shares_types from "../shares/types.js";
import type * as sidebarItems_baseFields from "../sidebarItems/baseFields.js";
import type * as sidebarItems_queries from "../sidebarItems/queries.js";
import type * as sidebarItems_sidebarItems from "../sidebarItems/sidebarItems.js";
import type * as sidebarItems_types from "../sidebarItems/types.js";
import type * as storage_mutations from "../storage/mutations.js";
import type * as storage_queries from "../storage/queries.js";
import type * as storage_types from "../storage/types.js";
import type * as tags_editorSpecs from "../tags/editorSpecs.js";
import type * as tags_mutations from "../tags/mutations.js";
import type * as tags_queries from "../tags/queries.js";
import type * as tags_tags from "../tags/tags.js";
import type * as tags_types from "../tags/types.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_types from "../users/types.js";
import type * as users_users from "../users/users.js";

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
  "campaigns/campaigns": typeof campaigns_campaigns;
  "campaigns/mutations": typeof campaigns_mutations;
  "campaigns/queries": typeof campaigns_queries;
  "campaigns/types": typeof campaigns_types;
  "characters/characters": typeof characters_characters;
  "characters/mutations": typeof characters_mutations;
  "characters/queries": typeof characters_queries;
  "characters/types": typeof characters_types;
  "common/identity": typeof common_identity;
  "common/slug": typeof common_slug;
  "common/types": typeof common_types;
  "editors/mutations": typeof editors_mutations;
  "editors/queries": typeof editors_queries;
  "editors/types": typeof editors_types;
  "files/types": typeof files_types;
  "folders/folders": typeof folders_folders;
  "folders/mutations": typeof folders_mutations;
  "folders/queries": typeof folders_queries;
  "folders/types": typeof folders_types;
  "gameMaps/gameMaps": typeof gameMaps_gameMaps;
  "gameMaps/mutations": typeof gameMaps_mutations;
  "gameMaps/queries": typeof gameMaps_queries;
  "gameMaps/types": typeof gameMaps_types;
  "gameMaps/validators": typeof gameMaps_validators;
  "locations/locations": typeof locations_locations;
  "locations/mutations": typeof locations_mutations;
  "locations/queries": typeof locations_queries;
  "locations/types": typeof locations_types;
  "notes/editorSpecs": typeof notes_editorSpecs;
  "notes/mutations": typeof notes_mutations;
  "notes/notes": typeof notes_notes;
  "notes/queries": typeof notes_queries;
  "notes/types": typeof notes_types;
  "sessions/mutations": typeof sessions_mutations;
  "sessions/queries": typeof sessions_queries;
  "sessions/sessions": typeof sessions_sessions;
  "sessions/types": typeof sessions_types;
  "shares/mutations": typeof shares_mutations;
  "shares/queries": typeof shares_queries;
  "shares/shares": typeof shares_shares;
  "shares/types": typeof shares_types;
  "sidebarItems/baseFields": typeof sidebarItems_baseFields;
  "sidebarItems/queries": typeof sidebarItems_queries;
  "sidebarItems/sidebarItems": typeof sidebarItems_sidebarItems;
  "sidebarItems/types": typeof sidebarItems_types;
  "storage/mutations": typeof storage_mutations;
  "storage/queries": typeof storage_queries;
  "storage/types": typeof storage_types;
  "tags/editorSpecs": typeof tags_editorSpecs;
  "tags/mutations": typeof tags_mutations;
  "tags/queries": typeof tags_queries;
  "tags/tags": typeof tags_tags;
  "tags/types": typeof tags_types;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/types": typeof users_types;
  "users/users": typeof users_users;
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

export declare const components: {};
