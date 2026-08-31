<h1 style="text-align:center">Stack Architect</h1>

![Stack Architect editor](public/preview.png)

Stack Architect is a browser-based editor for tech stack diagrams. Drag services onto a canvas, group them into layers, connect them, and export the result as PNG, SVG, or JSON. Diagram editing and local persistence work without an account. Optional sharing uses Turso.

## Features

- Several hundred brand icons from [svgl](https://svgl.app), with a curated catalog for common services.
- Tech cards, resizable group frames, and text notes.
- Connections that choose sensible endpoints and keep labels clear of nodes. Endpoints can also be pinned manually.
- Dagre auto-layout for arranging a rough diagram into layers.
- Undo and redo with 60 snapshots, copy and paste, multi-select, keyboard shortcuts, and grid snapping.
- Alt-drag duplication plus Ctrl-held alignment and equal-spacing guides.
- Local autosave, JSON import, and PNG, SVG, or JSON export.
- Short share links with queued server sync for the browser that created the link.

## Sharing

Selecting Share creates a project in Turso and copies a link such as `/?project=abc123DEF456`.

The browser that creates the project stores a private edit token in localStorage. It queues local changes and syncs them once per minute. The save indicator shows whether changes are local, pending, syncing, or synced. Its refresh button sends changes immediately.

A recipient only receives the public project ID. Opening the link imports the latest server copy into localStorage, removes the query parameter, and leaves the recipient with an independent local diagram. Recipients never receive the edit token and cannot overwrite the shared source.

The API accepts diagrams up to 1 MB. It allows 10 new projects per client per minute and 30 updates per client and project per minute.

Rate-limit counters live in Turso, so they apply across server instances. The server stores an HMAC fingerprint of each client address rather than the address itself.

## Tech stack

- Vite, React 19, and TypeScript
- Nitro server routes
- Turso through `@tursodatabase/serverless`
- [React Flow](https://reactflow.dev) for the canvas
- Zustand for editor state, history, and persistence
- Tailwind CSS v4 and shadcn/ui components
- React Compiler through Babel

## Local development

Install dependencies and start the dev server:

```bash
npm install
cp .env.example .env
npm run dev
```

Set the following variables in `.env` to enable sharing:

```env
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-database-token
```

Keep both values on the server. Do not expose them through `VITE_` variables.

The share API creates and upgrades its tables on first use. [`server/schema.sql`](server/schema.sql) contains the base schema if you prefer to create it yourself.

## Checks

```bash
npm run lint
npm run build
```

`npm run build` also runs the TypeScript compiler. The repository does not have an automated test runner yet.

## Project layout

```text
src/
  components/
    app/                 top bar and editor shell
    flow/                canvas, nodes, inspector, and asset palette
    ui/                  shared interface components
  hooks/                 editor shortcuts, theme, and responsive helpers
  lib/
    store.ts             diagram state, undo and redo, localStorage
    project-sync.ts      queued creator sync and edit-token persistence
    share.ts             public import links and share API client
    smart-guides.ts      alignment and equal-spacing calculations
    types.ts             diagram serialization types
    catalog.ts           curated technology catalog
    catalog-generated.ts generated svgl catalog
    export.ts            PNG, SVG, and JSON import and export
server/
  api/                   Nitro share endpoints
  utils/                 Turso connection, schema migration, and rate limits
  schema.sql             base Turso schema
```

## Updating the icon catalog

Curated entries in `src/lib/catalog.ts` take priority. The generated catalog scans `@ridemountainpig/svgl-react` and reads metadata from the svgl API.

After updating the svgl package, regenerate the catalog:

```bash
node scripts/generate-svgl-catalog.mjs
```

If an icon uses a different export name than its catalog slug, add the mapping in `src/lib/icons.ts`. Do not rename the slug across the catalog.

## Repository notes

- TypeScript uses `verbatimModuleSyntax` and `erasableSyntaxOnly`. Use `import type` for type-only imports.
- Commit both `package-lock.json` and `bun.lock` when dependencies change.
- To reset local editor state, remove the `tech-stack-architect:*` keys from localStorage.
