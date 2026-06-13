# Pi Extensions

A collection of [pi coding agent](https://github.com/badlogic/pi-mono) extensions.

Each package is independently installable via `pi install`.

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| `@tanqiuliu/pi-questionnaire` | Tool-first questionnaire flow + `/questionnaire` demo command | `pi install npm:@tanqiuliu/pi-questionnaire` |

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

## Publishing

Versioning and publishing are managed with [Changesets](https://github.com/changesets/changesets):

```bash
bun run changeset    # record a change
bun run version      # bump versions + changelogs
bun run publish      # build + publish
```
