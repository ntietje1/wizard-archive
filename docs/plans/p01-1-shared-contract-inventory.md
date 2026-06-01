# P01.1 Shared Contract Extraction Inventory

Source plan: https://www.notion.so/372cf83cc39681889231c0be7f49bbec

Observed commit during fleshing: `b45950f9ab336330ded68cd0e329c52947aba2f6`

## Boundary Rule

`shared/` owns browser-safe contracts and deterministic pure planners. `convex/` owns Convex validators, persistence adapters, auth and permission enforcement, queries, mutations, actions, transactions, generated APIs, and backend-only behavior modules. `src/` should import generated/client-safe Convex APIs plus `shared/` contracts.

No package layer should re-export another module's API. Consumers import directly from the owning module so ownership stays visible at each call site, and CI enforces this with `vp run check:no-reexports`.

## Contract Families

| Family                                        |           Current local Convex imports from `src/**` | Current owner                                                                                                              | Target owner                                                                                   | Plan owner                                               |
| --------------------------------------------- | ---------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Filesystem, parent targets, default names     |                                                   66 | `convex/sidebarItems/filesystem`, `convex/sidebarItems/validation/parent`, `convex/sidebarItems/functions/defaultItemName` | `shared/sidebar-items/filesystem`, `shared/sidebar-items/parent`, existing shared name helpers | Later P01.1 slices; lifecycle depth continues in P10     |
| Storage and upload validation                 |                                                    5 | `convex/storage/validation`                                                                                                | `shared/files` or `shared/storage`                                                             | Later P01.1 slice                                        |
| Link parsing, resolution, and drop validation |                                                   16 | `convex/links`                                                                                                             | `shared/links`                                                                                 | Later P01.1 slice; panels continue in P23                |
| Permissions                                   |                                                   46 | `convex/permissions`                                                                                                       | `shared/permissions`                                                                           | Later P01.1 slice; inheritance semantics continue in P08 |
| Editor and preference constants               |                                                   22 | `convex/editors/types`, `convex/userPreferences/types`                                                                     | `shared/editor`, `shared/user-preferences` where client-safe                                   | Later P01.1 slice; state ownership continues in P15      |
| Client error contract                         |                                                    5 | `convex/errors`                                                                                                            | `shared/errors/client`                                                                         | P01.1 Slice 1                                            |
| Headless BlockNote/Yjs conversion             | 1 known backend-test-to-src import plus split owners | `src/features/editor/blocknote-yjs`, `convex/notes/blocknoteNode`, `shared/editor-blocks`                                  | Explicit shared headless adapter                                                               | P01.3                                                    |

Counts include tests and were gathered with `rg` during plan fleshing. Treat them as directional inventory, not a CI gate; P01.2 owns enforcement.

## Slice 1 Decision

The client error contract is the first extraction because it is a small leaf family with no schema impact. Frontend code should import `ERROR_CODE`, `isClientError`, and `getClientErrorMessage` from `shared/errors/client`. Convex code keeps `throwClientError` in `convex/errors.ts`.

## Final Implementation Pass

The implementation expanded beyond the original slice-one extraction and moved the planned browser-safe families into direct shared owners where they were already pure: filesystem planners and receipts, parent target validation, default names, storage/upload validation, link parsing and resolution, permission levels, editor/preference constants, and the client error contract.

The cleanup intentionally deleted forwarding files instead of preserving compatibility barrels. Backend modules now keep only backend behavior, and frontend/backend callers import shared contracts directly from `shared/`.
