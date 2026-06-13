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

## Local verification (Verdaccio)

Before publishing for real, verify the exact tarball users will get by
publishing to a local [Verdaccio](https://verdaccio.org) registry and
installing it with `pi`. The bundled config allows anonymous publish, so no
`npm login` is needed.

```bash
# 1. Start the local registry (http://localhost:4873) — leave it running.
bun run registry:start

# 2. In another terminal, publish changed packages to it under the `local` tag.
bun run publish:local

# 3. Install with pi, pointing npm at the local registry.
npm_config_registry=http://localhost:4873 pi install npm:@tanqiuliu/pi-questionnaire

# 4. Confirm it registered, then exercise the extension in pi.
pi list

# Clean up when done.
pi uninstall npm:@tanqiuliu/pi-questionnaire
```

Notes:
- `pi install` has **no `--registry` flag** — set the registry via the
  `npm_config_registry` env var (pi shells out to npm, which reads it).
- Republishing the same version fails ("already exists"). To re-test, bump the
  version (see below) or wipe the registry: `rm -rf .verdaccio/storage`.
- For faster source iteration (skips the registry entirely):
  `pi install ./packages/<name>`.

## Publishing

Versioning and publishing are managed with [Changesets](https://github.com/changesets/changesets).
The version in `package.json` is **not** edited by hand — Changesets owns it.

```bash
# 1. Record what changed (pick package + major/minor/patch + summary).
bun run changeset

# 2. Apply version bumps + generate CHANGELOG.md, then commit.
bun run version
git add -A && git commit -m "Version packages"

# 3. Publish to the public npm registry (requires `npm login`).
bun run publish        # changeset publish — only pushes unpublished versions
git push --follow-tags
```

Scoped packages publish publicly via `"access": "public"` in
`.changeset/config.json`. Verify a release with
`npm view @tanqiuliu/pi-questionnaire`.
