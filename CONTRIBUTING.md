# Contributing to Cursor Claw

**Cursor Claw** (`cursor-calw` on [npm](https://www.npmjs.com/package/cursor-calw), [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw) on GitHub) exists because Cursor Pro+ subscribers deserve **inspectable machinery** — not folklore. Contributions that keep CLI behavior honest, documented, and test-backed are welcome.

Before you draft prose patches, read **[docs/README.md → Editorial covenant](docs/README.md#editorial-covenant)** — it keeps Markdown aligned across this repo.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **≥ 18** (see `"engines"` in [`package.json`](package.json)). Run `node -v`. |
| **git** · **curl** | Required for Swarm workflows and ConnectRPC probing via `ca2`. |

---

## Reporting issues

- Open [GitHub Issues](https://github.com/kariemSeiam/cursor-calw/issues) with **reproduction**, `node -v`, exact command lines, observed vs expected.
- Mention whether the failure touches **`ca`** (SDK/local), **`ca2`** (curl RPC), **`ca3`** (swarm/worktrees), or **docs**.

---

## Development workflow

1. Fork **`cursor-calw`** → branch from **`main`**.
2. `npm ci` (CI uses the same lockfile discipline).
3. Keep changes **narrow** unless a maintainer-approved refactor is in flight.

---

## Verification (blocking before PR)

```bash
npm run lint
npm test
```

| Suite | Meaning |
|-------|---------|
| `npm test` | `node:test` suites under [`test/`](test/). |
| `npm run lint` | ESLint 9 (`eslint.config.js`). **Warnings allowed today** unless CI adopts `--max-warnings 0`. |

New behavior warrants tests or a deliberate exception noted in PR description.

---

## Code & documentation coupling

| If you change… | Update also… |
|----------------|--------------|
| `ca` · `ca2` · `ca3` public flags or subcommands | [README.md](README.md) CLI tables |
| Swarm internals, limits, filenames | [`docs/architecture.md`](docs/architecture.md) |
| Operator playbook material | [`docs/swarm-patterns.md`](docs/swarm-patterns.md) or [`docs/troubleshooting.md`](docs/troubleshooting.md) |
| RPC / HTTP catalog | [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) (and [`docs/architecture.md`](docs/architecture.md) if topology changes) |

**Never** stash secrets — keys live in `CURSOR_API_KEY` / `~/.cursor-api-key` per [README](README.md) and [.env.example](.env.example).

---

## Pull requests

- Motivation paragraph + behavioural summary — reviewers should reconstruct intent without archaeology.
- `Fixes #nnn` hooks when applicable.
- Release-facing changes logged under **[CHANGELOG.md](CHANGELOG.md) `[Unreleased]`**.

Community tone: **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**

---

## Releases (maintainers)

Tag-driven publish per [`.github/workflows/publish.yml`](.github/workflows/publish.yml): push **`v*`** tags after versioning `package.json` and consolidating **CHANGELOG**.

```bash
git tag v1.x.x && git push origin v1.x.x
```

Configure **`NPM_TOKEN`** with publish capability for **`cursor-calw`**.
