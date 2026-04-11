# The Wizard's Archive

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Convex](https://img.shields.io/badge/Convex-FF731D?style=for-the-badge)
![TanStack Router](https://img.shields.io/badge/TanStack_Router-EF4444?style=for-the-badge)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-453F39?style=for-the-badge)
![BlockNote](https://img.shields.io/badge/BlockNote-6C63FF?style=for-the-badge)
![Yjs](https://img.shields.io/badge/Yjs-6EDB8F?style=for-the-badge)
![Better Auth](https://img.shields.io/badge/Better_Auth-1A1A2E?style=for-the-badge)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

A campaign management platform built for Dungeon Masters and their players. Organize your world, share what your players need to see, and keep your secrets safe — all in real time.

<!-- TODO: Add screenshot or demo GIF -->

## Features

### Campaign Management

- Create and run multiple campaigns with unique invite links
- Manage players and membership across campaigns
- Start and track game sessions
- DM "view-as" mode to preview exactly what a player sees

### Rich-Text Notes

- Block-based editor powered by BlockNote with slash commands, formatting toolbar, and drag-to-reorder
- Real-time collaborative editing via Yjs — multiple users can edit the same note simultaneously
- Wiki-links with autocomplete to connect notes, maps, and files across your campaign
- Block-level sharing — selectively reveal or hide individual blocks per player

### Canvases

- Freeform visual workspaces for spatial thinking — sketch, diagram, and lay out ideas on an infinite canvas
- Drawing tools with adjustable brush sizes, eraser, shapes, sticky notes, and text nodes
- Embed other campaign content (notes, folders, canvases) as interactive nodes
- Real-time collaboration with remote cursor visibility
- Pan, zoom, minimap, and fit-to-view navigation
- Snapshot history with rollback

### Sidebar & Organization

- Hierarchical content tree with folders, notes, canvases, game maps, and files
- Drag-and-drop reordering and nesting throughout the app — sidebar items, editor blocks, map pins, and canvas nodes
- Context menus across the sidebar, editor, and maps for quick actions
- Soft-delete with trash and recovery
- Search and slug-based navigation
- Bookmark items for quick access during sessions

### Game Maps

- Upload map images and place interactive pins linked to sidebar items
- Pan, zoom, and manage pin visibility per player
- Link pins directly to notes, files, or folders for in-context detail

### File Management

- Upload and organize campaign assets (images, PDFs, documents)
- File previews, type detection, and download support
- Multi-file upload with progress tracking

### Sharing & Permissions

- Three-tier permission model: **none**, **view**, and **edit**
- Share individual items or entire folders (permissions cascade to children)
- Share with specific players or all campaign members at once
- DMs always retain full access — players only see what they're meant to

### Authentication & Accounts

- Email/password sign-up with two-factor authentication
- OAuth provider support
- Password reset flows and session management

## Tech Stack

| Layer           | Technologies                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Frontend**    | React 19, TypeScript, TanStack Router, TanStack React Query, Tailwind CSS v4, shadcn/ui, Zustand |
| **Editor**      | BlockNote, Yjs, Tiptap                                                                           |
| **Canvases**    | ReactFlow, Yjs                                                                                   |
| **Maps**        | React Zoom Pan Pinch                                                                             |
| **Drag & Drop** | Atlaskit Pragmatic Drag and Drop                                                                 |
| **Backend**     | Convex (real-time database, serverless functions, file storage)                                  |
| **Auth**        | Better Auth (email/password, OAuth, 2FA)                                                         |
| **Deployment**  | Cloudflare Workers (serverless edge)                                                             |
| **Tooling**     | Vite+, Vitest, Playwright, React Compiler                                                        |

## Testing

| Suite        | Runner                | Scope                                                                                                       |
| ------------ | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Backend**  | Vitest (edge-runtime) | 53 test files, 651 tests — mutations, queries, permissions, cascading deletes, sharing workflows, snapshots |
| **Frontend** | Vitest (jsdom)        | 24 test files, 358 tests — components, hooks, stores, utilities                                             |
| **E2E**      | Playwright (Chromium) | Full user flows — campaign creation, note editing, sharing, navigation                                      |

Backend and frontend suites run on every push via GitHub Actions. E2E tests run in CI and locally against a live app instance.
