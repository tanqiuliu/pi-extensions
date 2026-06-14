# Agents Instructions

## Codebase Practices

1. Use package.json scripts when possible.
2. Use `bun` package manager instead of `npm` / `pnpm` / `yarn`.
3. Do not add npm publishing, Changesets, or local registry workflows; this repo is installed through git or local paths.

## Creating and maintaining Pi Extensions

1. Refer to the public Pi extension documentation when developing extensions: https://pi.dev/docs/latest/extensions
2. Avoid creating big index.ts files, advocate to separate logic in different files and folders to organize them.
3. Create extensions using a domain-driven approach to avoid huge files — group code by domain concepts and responsibilities.
4. Create extensions using a TDD approach to make sure that the code generated builds with the correct logic.
5. Prefer less code to avoid too many moving parts, but never take shortcuts — simplicity without sacrificing correctness.
6. Structure each extension package as `packages/<name>/extensions/<name>/index.ts` with supporting files beside that `index.ts`. Point the package-local `pi.extensions` array at `./extensions/<name>`.
7. When adding a new extension, also add its path to the **root `package.json` `pi.extensions`** array (e.g. `./packages/<name>/extensions/<name>`). The root manifest is what `pi install git:...` reads after cloning the monorepo — pi's git source has no subdirectory syntax, so anything missing from the root array won't install via git.
8. Keep the extension directory name meaningful because Pi derives the compact startup extension label from the loaded resource path. For example, `extensions/questionnaire` displays as `questionnaire`.

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
