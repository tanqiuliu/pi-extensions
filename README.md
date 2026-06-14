# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Extensions are installed via `pi install` from git or local paths.

## Packages

| Package | Description |
|---------|-------------|
| `@tanqiuliu/pi-questionnaire` | Tool-first questionnaire flow + `/questionnaire` demo command |

## Install

The whole collection can be installed straight from git:

```bash
pi install git:github.com/tanqiuliu/pi-extensions          # latest on default branch
pi install git:github.com/tanqiuliu/pi-extensions@main     # pin a branch/tag/commit
```

This works because the **root `package.json` declares `pi.extensions`** listing
every package's extension path — pi reads that from the repo root after cloning.
pi's git source has no subdirectory syntax (only an optional `@ref`), so a single
root manifest is how a monorepo exposes its extensions. **When you add a new
extension, add its path to the root `pi.extensions` array too**, or it won't be
picked up by a git install.

For a single extension during local development, install from the path instead:

```bash
pi install ./packages/questionnaire
```

## Development

This repo uses [Bun](https://bun.sh) workspaces.

```bash
git clone <repo-url>
cd pi-extensions
bun install
```

Common scripts (run from the repo root, fan out across all packages):

```bash
bun run typecheck    # tsc --noEmit per package
bun run lint         # oxlint
bun run format       # oxfmt --write
```

### Adding a new extension

1. Create `packages/<name>/` following the structure of `packages/questionnaire`.
2. Give it a `package.json` with a `pi.extensions` array pointing at `./extensions/<name>`.
3. Keep extension source Node.js-compatible (see [AGENTS.md](./AGENTS.md)).

## License

This project is licensed under the MIT License (see [LICENSE](./LICENSE)).

It includes code derived from third-party MIT-licensed projects. 
See [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt) for full attributions.
