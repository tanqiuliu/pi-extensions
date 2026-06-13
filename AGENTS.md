# Agents Instructions

## Codebase Practices

1. Use package.json scripts when possible.
2. Use `bun` package manager instead of `npm` / `pnpm` / `yarn`. `bun` is pinned via `mise.toml`; if it isn't on `PATH`, run it as `mise exec -- bun ...`.
3. Never hand-edit a package's `version` field — Changesets owns versioning.

## Local Verification (Verdaccio)

Verify the published tarball before any real release. Full steps are in the
[README](./README.md#local-verification-verdaccio); the essentials:

1. `bun run registry:start` — local registry at `http://localhost:4873` (anonymous publish allowed; no `npm login`). Leave it running.
2. `bun run publish:local` — publish changed packages to it under the `local` tag.
3. `npm_config_registry=http://localhost:4873 pi install npm:<pkg>` — `pi install` has **no `--registry` flag**; the registry comes from the `npm_config_registry` env var.
4. Republishing the same version fails — bump it via Changesets or `rm -rf .verdaccio/storage` to re-test.

## Publishing

Versioning and publishing go through [Changesets](https://github.com/changesets/changesets) — see the [README](./README.md#publishing). Flow: `bun run changeset` → `bun run version` (+ commit) → `bun run publish` (needs `npm login`) → `git push --follow-tags`.

1. **NEVER install packages manually** on the local machine (no `npm install -g`, `bun add -g`, etc.). Packages are consumed via `pi install` / `pi update` — the standard pi flow handles everything.
2. After a publish, just confirm it succeeded. Do not run any global install command.

## Creating and maintaining Pi Extensions

1. Avoid creating big index.ts files, advocate to separate logic in different files and folders to organize them.
2. Create extensions using a domain-driven approach to avoid huge files — group code by domain concepts and responsibilities.
3. Create extensions using a TDD approach to make sure that the code generated builds with the correct logic.
4. Prefer less code to avoid too many moving parts, but never take shortcuts — simplicity without sacrificing correctness.
5. When adding a new extension, also add its path to the **root `package.json` `pi.extensions`** array (e.g. `./packages/<name>/extensions/<name>`). The root manifest is what `pi install git:...` reads after cloning the monorepo — pi's git source has no subdirectory syntax, so anything missing from the root array won't install via git.

### Runtime constraint: Extensions run on Node.js, not Bun

Pi loads extensions at runtime via [jiti](https://github.com/unjs/jiti) on **Node.js**. Even though this monorepo uses `bun` as package manager and test runner, **extension source code must not import Bun-specific modules** (e.g. `import { Glob } from 'bun'`, `import { serve } from 'bun'`). Use Node.js built-in APIs instead:

| Instead of (Bun)          | Use (Node.js)                                |
|---------------------------|----------------------------------------------|
| `Glob` from `'bun'`       | `readdir(path, { recursive: true })` from `'node:fs/promises'` |
| `Bun.file()`              | `readFile()` from `'node:fs/promises'`       |
| `Bun.write()`             | `writeFile()` from `'node:fs/promises'`      |
| `Bun.serve()`             | `createServer()` from `'node:http'`          |
| `Bun.spawn()`             | `spawn()` / `execFile()` from `'node:child_process'` |

**Test files** (`test/**/*.test.ts`) run under `bun test` and _can_ use Bun APIs freely — only the `extensions/` source that ships in the package must be Node-compatible.
