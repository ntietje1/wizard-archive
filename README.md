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
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

A real-time campaign workspace for Dungeon Masters and their players. Campaign content is modeled as one canonical resource graph with explicit identity, lifecycle, access, and content boundaries.

<!-- TODO: Add screenshot or demo GIF -->

## Features

### Campaigns and access

- Create and run multiple campaigns with unique invite links
- Manage players and membership across campaigns
- Start and track game sessions
- DM "view-as" mode to preview exactly what a player sees
- Project only the resources and capabilities available to the active campaign member

### Resources

- Organize folders, notes, canvases, maps, and files in one title-first hierarchy
- Use stable UUIDv7 identities for routes, embeds, commands, and persistence
- Move, copy, archive, restore, trash, and permanently delete through one command protocol
- Resolve active, archived, and trashed collections through one authoritative resource index

### Editors and content

- Edit BlockNote documents collaboratively with Yjs
- Build canvases with text, drawing, and resource embed nodes
- View campaign maps with resource-linked pins
- Upload, preview, and download file resources
- Embed resources by identity or reference external URLs

### Portability and reliability

- Export and import self-contained Wizard Archive bundles
- Preserve source aliases for import diagnostics without using them as resource identity
- Apply optimistic commands with typed receipts and authoritative reconciliation
- Represent loading, unavailable, unknown, missing, and rejected states explicitly

### Authentication & Accounts

- Email/password sign-up with two-factor authentication
- OAuth provider support
- Password reset flows and session management

## Tech Stack

| Layer          | Technologies                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **Frontend**   | React 19, TypeScript, TanStack Router, TanStack React Query, Tailwind CSS v4, shadcn/ui, Zustand |
| **Editor**     | BlockNote, Yjs                                                                                   |
| **Canvases**   | Custom canvas editor, Yjs                                                                        |
| **Validation** | Zod, Convex Validators                                                                           |
| **Backend**    | Convex (real-time database, serverless functions, file storage)                                  |
| **Auth**       | Better Auth (email/password, OAuth, 2FA)                                                         |
| **Deployment** | Cloudflare Workers (serverless edge)                                                             |
| **Tooling**    | Vite+, Vitest, Playwright, React Compiler                                                        |
