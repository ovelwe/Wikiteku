# Wikiteku

- Follow `docs/plan.md`; implement only the phase requested by the user.
- Keep reads server-first. Validate every mutation and check permissions on the server.
- Treat article Markdown, links, and uploaded media as untrusted.
- Use PostgreSQL and Drizzle migrations; never replace persistence with mock arrays.
- Keep the platform theme separate from fandom and page themes. Full-page backgrounds must preserve usable platform navigation.
- Validate Puck documents on both client and server, including insertion metadata and nested slots. Errors must identify the block and field. Verify add, edit, save, reload and publish in the browser.
- Treat custom tags as plain text. Normalize and validate them on the server; search must preserve visibility and publication checks.
- Translate visible Studio controls and accessibility labels into Russian. Document remaining localization limits honestly.
- Motion must honor prefers-reduced-motion. Bundle Cyrillic fonts locally; reject arbitrary CSS and scripts in themes.
- Before deployment cleanup, identify the exact database and deletion scope, take a restorable backup, and retain migration history. Never assume user content is disposable test data.
- Run typecheck, Biome, tests, and build after material changes.
- Keep the Phase 1 live PostgreSQL/auth smoke test and its remaining limits documented in `docs/plan.md`.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
