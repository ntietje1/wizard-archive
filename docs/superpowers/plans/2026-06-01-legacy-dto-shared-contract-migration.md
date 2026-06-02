# Legacy DTO Shared Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `legacyDtoTypeModules` from the import-boundary checker by moving the remaining browser-consumed Convex DTO/type contracts into `shared/`.

**Architecture:** `shared/` owns browser-safe DTO contracts and deterministic type unions. `convex/` imports those shared contracts for backend query/mutation return shapes where useful, but keeps Convex runtime functions, validators, persistence, and generated APIs. `src/` imports generated/client-safe Convex APIs plus `shared/**` contracts only.

**Tech Stack:** TypeScript, Convex, Vite+, Vitest, React Doctor, Fallow.

---

## Current Legacy Allowlist

The current allowlist in `scripts/import-boundaries.mjs` permits these `src` type-only imports:

- `convex/blocks/functions/searchBlocks`
- `convex/campaigns/types`
- `convex/canvases/types`
- `convex/editHistory/types`
- `convex/files/types`
- `convex/folders/types`
- `convex/gameMaps/types`
- `convex/notes/types`
- `convex/sessions/types`
- `convex/sidebarItems/types/types`
- `convex/sidebarShares/types`
- `convex/users/types`
- `convex/yjsSync/functions/types`

Measured `src` import counts on 2026-06-01:

- `convex/sidebarItems/types/types`: 93
- `convex/campaigns/types`: 20
- `convex/gameMaps/types`: 20
- `convex/notes/types`: 20
- `convex/folders/types`: 11
- `convex/users/types`: 6
- `convex/files/types`: 6
- `convex/canvases/types`: 4
- `convex/blocks/functions/searchBlocks`: 2
- `convex/sessions/types`: 2
- `convex/sidebarShares/types`: 2
- `convex/yjsSync/functions/types`: 2
- `convex/editHistory/types`: 1

## File Structure

Create shared contract modules:

- `shared/common/ids.ts` - branded `SharedId<TableName>` and concrete shared table id aliases.
- `shared/users/types.ts` - `ProfileImage`, `UserProfileFromDb`, `UserProfile`, and test/client-safe auth profile types without importing `convex/server`.
- `shared/campaigns/types.ts` - campaign status/member constants and campaign/member DTOs.
- `shared/sessions/types.ts` - session DTO.
- `shared/sidebar-items/model-types.ts` - sidebar row/enhanced/with-content base types and `AnySidebarItem*` unions.
- `shared/files/types.ts`, `shared/folders/types.ts`, `shared/canvases/types.ts`, `shared/notes/types.ts`, `shared/game-maps/types.ts` - type-specific sidebar item DTOs and history/snapshot constants.
- `shared/edit-history/types.ts` - edit history action and metadata map contracts.
- `shared/sidebar-shares/types.ts` - sidebar share DTO.
- `shared/yjs-sync/types.ts` - `YjsDocumentId`.
- `shared/search/types.ts` - `BlockSearchResult`.

Modify Convex modules:

- `convex/*/types.ts`, `convex/sidebarItems/types/baseTypes.ts`, `convex/sidebarItems/types/types.ts`, `convex/editHistory/types.ts`, `convex/blocks/functions/searchBlocks.ts`, and `convex/yjsSync/functions/types.ts`.
- These modules should either be deleted after imports move, or converted into backend-only implementation files if they contain runtime behavior. Do not leave re-export wrappers.

Modify frontend imports:

- Replace every `src/**` import from the legacy Convex modules with the corresponding `shared/**` owner.

Modify tooling:

- `scripts/import-boundaries.mjs`
- `src/shared/utils/__tests__/import-boundaries.test.ts`

---

### Task 1: Add Shared ID Foundation

**Files:**

- Create: `shared/common/ids.ts`
- Modify: `shared/sidebar-items/filesystem/types.ts`

- [ ] **Step 1: Add the shared id module**

Create `shared/common/ids.ts`:

```ts
export type SharedId<TableName extends string> = string & { __tableName: TableName }

export type CampaignId = SharedId<'campaigns'>
export type CampaignMemberId = SharedId<'campaignMembers'>
export type EditHistoryId = SharedId<'editHistory'>
export type FileSystemTransactionId = SharedId<'filesystemTransactions'>
export type SessionId = SharedId<'sessions'>
export type SidebarItemId = SharedId<'sidebarItems'>
export type SidebarItemShareId = SharedId<'sidebarItemShares'>
export type StorageId = SharedId<'_storage'>
export type UserProfileId = SharedId<'userProfiles'>
```

- [ ] **Step 2: Replace local id brands in filesystem shared types**

In `shared/sidebar-items/filesystem/types.ts`, remove local `SharedId` aliases and import:

```ts
import type {
  CampaignId,
  FileSystemTransactionId,
  SidebarItemId,
  StorageId,
  UserProfileId,
} from '../../common/ids'
```

- [ ] **Step 3: Run focused typecheck**

Run: `vp check --fix`

Expected: no type errors from the extracted id aliases.

### Task 2: Move Leaf DTO Contracts First

**Files:**

- Create: `shared/users/types.ts`
- Create: `shared/sessions/types.ts`
- Create: `shared/sidebar-shares/types.ts`
- Create: `shared/yjs-sync/types.ts`
- Modify consumers in `src/**` and `convex/**`

- [ ] **Step 1: Move user profile DTOs**

Create `shared/users/types.ts`:

```ts
import type { UserProfileId, StorageId } from '../common/ids'
import type { Username } from './validation'

export type ProfileImage =
  | { type: 'external'; url: string }
  | { type: 'storage'; storageId: StorageId }

export type UserProfileFromDb = {
  _id: UserProfileId
  _creationTime: number
  authUserId: string
  username: Username
  email: string | null
  emailVerified: boolean | null
  name: string | null
  profileImage: ProfileImage | null
  twoFactorEnabled: boolean | null
}

export type UserProfile = Omit<UserProfileFromDb, 'profileImage'> & {
  imageUrl: string | null
}
```

Do not move `AuthUser` as-is because it imports `UserIdentity` from `convex/server`; keep that as backend-only in a Convex-owned module if still needed.

- [ ] **Step 2: Move session DTO**

Create `shared/sessions/types.ts`:

```ts
import type { CampaignId, SessionId } from '../common/ids'

export type Session = {
  _id: SessionId
  _creationTime: number
  campaignId: CampaignId
  name: string | null
  startedAt: number
  endedAt: number | null
}
```

- [ ] **Step 3: Move sidebar share DTO**

Create `shared/sidebar-shares/types.ts`:

```ts
import type {
  CampaignId,
  CampaignMemberId,
  SessionId,
  SidebarItemId,
  SidebarItemShareId,
} from '../common/ids'
import type { PermissionLevel } from '../permissions/types'
import type { SidebarItemType } from '../sidebar-items/types'

export type SidebarItemShare = {
  _id: SidebarItemShareId
  _creationTime: number
  campaignId: CampaignId
  sidebarItemId: SidebarItemId
  sidebarItemType: SidebarItemType
  campaignMemberId: CampaignMemberId
  sessionId: SessionId | null
  permissionLevel: PermissionLevel | null
}
```

- [ ] **Step 4: Move Yjs sync type**

Create `shared/yjs-sync/types.ts`:

```ts
import type { SidebarItemId } from '../common/ids'

export type YjsDocumentId = SidebarItemId
```

- [ ] **Step 5: Rewrite imports for these leaf modules**

Use targeted replacements:

- `convex/users/types` -> `shared/users/types` for `src/**` imports.
- `convex/sessions/types` -> `shared/sessions/types`.
- `convex/sidebarShares/types` -> `shared/sidebar-shares/types`.
- `convex/yjsSync/functions/types` -> `shared/yjs-sync/types`.

Convex runtime files that need these DTOs should also import the shared modules directly.

- [ ] **Step 6: Delete obsolete Convex type files if no imports remain**

Run:

```powershell
rg -n "convex/(users/types|sessions/types|sidebarShares/types|yjsSync/functions/types)" src convex shared --glob "*.ts" --glob "*.tsx"
```

Expected: no results except generated references that are removed by codegen. Delete obsolete files only when the search is clean.

### Task 3: Move Campaign DTOs

**Files:**

- Create: `shared/campaigns/types.ts`
- Modify: `src/**`, `convex/**`
- Delete or retire: `convex/campaigns/types.ts`

- [ ] **Step 1: Create shared campaign DTOs**

Create `shared/campaigns/types.ts`:

```ts
import type { CampaignId, SessionId, UserProfileId } from '../common/ids'
import type { CampaignSlug } from './validation'
import type { UserProfile } from '../users/types'

export const CAMPAIGN_STATUS = {
  Active: 'Active',
  Inactive: 'Inactive',
  Deleted: 'Deleted',
} as const

export type CampaignStatus = (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS]

export const CAMPAIGN_MEMBER_ROLE = {
  DM: 'DM',
  Player: 'Player',
} as const

export type CampaignMemberRole = (typeof CAMPAIGN_MEMBER_ROLE)[keyof typeof CAMPAIGN_MEMBER_ROLE]

export const CAMPAIGN_MEMBER_STATUS = {
  Accepted: 'Accepted',
  Pending: 'Pending',
  Rejected: 'Rejected',
  Removed: 'Removed',
} as const

export type CampaignMemberStatus =
  (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS]

export type CampaignFromDb = {
  _id: CampaignId
  _creationTime: number
  dmUserId: UserProfileId
  name: string
  description: string
  slug: CampaignSlug
  status: CampaignStatus
  currentSessionId: SessionId | null
}

export type CampaignMemberFromDb = {
  _id: string
  _creationTime: number
  userId: UserProfileId
  campaignId: CampaignId
  role: CampaignMemberRole
  status: CampaignMemberStatus
}

export type CampaignMember = CampaignMemberFromDb & {
  userProfile: UserProfile
}

export type Campaign = CampaignFromDb & {
  dmUserProfile: UserProfile
  myMembership: CampaignMember | null
  playerCount: number
}
```

If a stronger `CampaignMemberId` alias is needed, add it to `shared/common/ids.ts` and use it instead of `_id: string`.

- [ ] **Step 2: Rewrite imports**

Replace `convex/campaigns/types` imports in `src/**` and `convex/**` with `shared/campaigns/types`.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
vp test run --config vitest.config.ts src/features/campaigns src/features/settings/components/tabs/campaign-people src/features/sharing
```

Expected: campaign, people, and sharing tests pass.

### Task 4: Move Sidebar Item Base and Type-Specific DTOs

**Files:**

- Create: `shared/sidebar-items/model-types.ts`
- Create: `shared/files/types.ts`
- Create: `shared/folders/types.ts`
- Create: `shared/canvases/types.ts`
- Create: `shared/notes/types.ts`
- Create: `shared/game-maps/types.ts`
- Modify: all `src/**` and `convex/**` imports from `convex/{files,folders,canvases,notes,gameMaps}/types` and `convex/sidebarItems/types/**`

- [ ] **Step 1: Move sidebar base model types**

Create `shared/sidebar-items/model-types.ts` using the existing shape from `convex/sidebarItems/types/baseTypes.ts`, but replace Convex `Id<...>` imports with aliases from `shared/common/ids.ts` and imports from `shared/sidebar-items/types`, `shared/sidebar-items/slug`, and `shared/permissions/types`.

The exported types must include:

```ts
export type SidebarItemRow<TType extends SidebarItemType = SidebarItemType> = { ... }
export type SidebarItemFromDb<TType extends SidebarItemType = SidebarItemType> = { ... }
export type SidebarItem<TType extends SidebarItemType = SidebarItemType> = { ... }
export type SidebarItemWithContent<TType extends SidebarItemType = SidebarItemType> = { ... }
```

- [ ] **Step 2: Move file/folder/canvas/note/game-map DTOs**

Create the five type-specific modules from the existing Convex modules. Use `shared/sidebar-items/model-types.ts` for base types and `shared/common/ids.ts` for ids.

Keep constants with their domain owner:

- `FILE_HISTORY_ACTION` in `shared/files/types.ts`
- `FOLDER_HISTORY_ACTION` in `shared/folders/types.ts`
- `CANVAS_SNAPSHOT_TYPE` and `CANVAS_HISTORY_ACTION` in `shared/canvases/types.ts`
- `NOTE_SNAPSHOT_TYPE` and `NOTE_HISTORY_ACTION` in `shared/notes/types.ts`
- `GAME_MAP_SNAPSHOT_TYPE`, `MAP_HISTORY_ACTION`, snapshot data types, and pin DTOs in `shared/game-maps/types.ts`

- [ ] **Step 3: Move `AnySidebarItem*` unions**

In `shared/sidebar-items/model-types.ts`, recreate the union map currently in `convex/sidebarItems/types/types.ts` using the shared type-specific modules:

```ts
export type AnySidebarItemRow = RowByType[SidebarItemTypeKey]
export type AnySidebarItemFromDb = FromDbByType[SidebarItemTypeKey]
export type AnySidebarItem = EnhancedByType[SidebarItemTypeKey]
export type AnySidebarItemWithContent = WithContentByType[SidebarItemTypeKey]
```

- [ ] **Step 4: Rewrite imports**

Replace imports:

- `convex/sidebarItems/types/types` -> `shared/sidebar-items/model-types`
- `convex/sidebarItems/types/baseTypes` -> `shared/sidebar-items/model-types`
- `convex/files/types` -> `shared/files/types`
- `convex/folders/types` -> `shared/folders/types`
- `convex/canvases/types` -> `shared/canvases/types`
- `convex/notes/types` -> `shared/notes/types`
- `convex/gameMaps/types` -> `shared/game-maps/types`

- [ ] **Step 5: Run focused tests**

Run:

```powershell
vp test run --config vitest.config.ts src/features/sidebar src/features/filesystem src/features/dnd src/features/editor/components/viewer src/features/canvas src/features/previews
vp test run --config convex/vitest.config.mts convex/sidebarItems convex/gameMaps convex/notes convex/files convex/canvases convex/folders convex/documentSnapshots
```

Expected: all touched sidebar item, filesystem, DnD, editor viewer, canvas, preview, and Convex domain tests pass.

### Task 5: Move Edit History and Search DTOs

**Files:**

- Create: `shared/edit-history/types.ts`
- Create: `shared/search/types.ts`
- Modify: `convex/editHistory/types.ts`
- Modify: `convex/blocks/functions/searchBlocks.ts`
- Modify imports in `src/**`

- [ ] **Step 1: Move edit history contracts**

Create `shared/edit-history/types.ts` from `convex/editHistory/types.ts`, importing history maps from the new shared type-specific modules.

- [ ] **Step 2: Move block search result**

Create `shared/search/types.ts`:

```ts
import type { SidebarItemId } from '../common/ids'
import type { BlockNoteId, BlockType } from '../editor-blocks/types'

export interface BlockSearchResult {
  blockNoteId: BlockNoteId
  noteId: SidebarItemId
  plainText: string
  type: BlockType
}
```

In `convex/blocks/functions/searchBlocks.ts`, import `BlockSearchResult` from `shared/search/types` and keep `searchBlocks` as Convex runtime code.

- [ ] **Step 3: Rewrite imports**

Replace:

- `convex/editHistory/types` -> `shared/edit-history/types`
- `convex/blocks/functions/searchBlocks` type imports in `src/**` -> `shared/search/types`

- [ ] **Step 4: Run focused tests**

Run:

```powershell
vp test run --config vitest.config.ts src/features/editor/components/right-sidebar src/features/search
vp test run --config convex/vitest.config.mts convex/editHistory convex/blocks convex/notes
```

Expected: edit-history and search tests pass.

### Task 6: Delete the Allowlist and Obsolete Convex Type Modules

**Files:**

- Modify: `scripts/import-boundaries.mjs`
- Modify: `src/shared/utils/__tests__/import-boundaries.test.ts`
- Delete obsolete Convex type files only after import searches are clean.

- [ ] **Step 1: Update boundary tests to make the old allowance fail**

In `src/shared/utils/__tests__/import-boundaries.test.ts`, replace the “allows accepted legacy Convex DTO type imports from src” test with:

```ts
it('blocks all local Convex DTO imports from src after shared DTO migration', () => {
  expect(
    analyzeImportBoundaries([
      {
        filePath: 'src/example.ts',
        source: [
          "import type { AnySidebarItem } from 'convex/sidebarItems/types/types'",
          "import type { GameMap } from 'convex/gameMaps/types'",
        ].join('\n'),
      },
    ]),
  ).toEqual([
    'src/example.ts:1 src may not import type from local Convex module convex/sidebarItems/types/types',
    'src/example.ts:2 src may not import type from local Convex module convex/gameMaps/types',
  ])
})
```

- [ ] **Step 2: Remove `legacyDtoTypeModules`**

In `scripts/import-boundaries.mjs`, delete the `legacyDtoTypeModules` set and change `isAllowedSrcConvexImport` to:

```js
function isAllowedSrcConvexImport(specifier, kind) {
  if (!specifier.startsWith('convex/')) return true
  if (packageConvexModules.has(specifier)) return true
  if (generatedConvexPrefixes.some((prefix) => specifier.startsWith(prefix))) return true
  if (isBlockedP01Contract(specifier)) return false
  return false
}
```

If `kind` is then unused, remove the parameter.

- [ ] **Step 3: Verify no old imports remain**

Run:

```powershell
rg -n "from ['\"]convex/(blocks/functions/searchBlocks|campaigns/types|canvases/types|editHistory/types|files/types|folders/types|gameMaps/types|notes/types|sessions/types|sidebarItems/types/types|sidebarShares/types|users/types|yjsSync/functions/types)['\"]" src convex shared --glob "*.ts" --glob "*.tsx"
```

Expected: no results.

- [ ] **Step 4: Delete obsolete Convex files**

Delete any old DTO files with no remaining imports. Do not leave wrappers or re-exports.

### Task 7: Final Verification and Notion Reconciliation

**Files:**

- Modify: relevant Notion plan record and workflow control.

- [ ] **Step 1: Run full required checks**

Run:

```powershell
vp run check:import-boundaries
vp run check:no-reexports
vp dlx convex codegen
vp check --fix
vp dlx react-doctor@latest . --verbose --fail-on error --diff=origin/main
vp run fallow
```

Expected:

- import boundaries pass with no `legacyDtoTypeModules`.
- no-reexports passes.
- Convex codegen passes.
- `vp check --fix` passes.
- React Doctor reports no issues.
- `vp run fallow` may still fail on baseline; run JSON filtering and confirm no changed-file dead-code or duplicate-export issues.

- [ ] **Step 2: Run targeted test suites**

Run the focused suites from Tasks 3-5 again after final cleanup:

```powershell
vp test run --config vitest.config.ts src/features/campaigns src/features/settings/components/tabs/campaign-people src/features/sharing src/features/sidebar src/features/filesystem src/features/dnd src/features/editor/components/viewer src/features/canvas src/features/previews src/features/search
vp test run --config convex/vitest.config.mts convex/sidebarItems convex/gameMaps convex/notes convex/files convex/canvases convex/folders convex/documentSnapshots convex/editHistory convex/blocks
```

- [ ] **Step 3: Update Notion**

Mark the dedicated plan resolved only after the verification evidence is fresh. Record:

- removed `legacyDtoTypeModules`
- zero legacy DTO imports from `src`
- direct shared owners for DTO/model contracts
- no re-export wrappers
- fallow baseline caveat if still present

---

## Self-Review

Spec coverage:

- The plan removes the temporary allowlist.
- The plan moves each allowlisted module to a shared owner or extracts only its browser-safe type from runtime Convex code.
- The plan includes import-boundary tightening and no-reexport constraints.
- The plan includes verification commands and Notion reconciliation.

Placeholder scan:

- No `TBD` or unresolved implementation placeholders remain.
- Each task has concrete files, commands, and expected outcomes.

Type consistency:

- Shared id aliases are introduced before DTO modules use them.
- Sidebar item unions are moved after leaf DTOs are available.
- Edit history moves after type-specific history maps are shared.
