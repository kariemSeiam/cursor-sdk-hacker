# Contributing to **cursor-calw**

**Maintainer:** [kariemSeiam](https://github.com/kariemSeiam) · **kariemseiam@gmail.com**

**cursor-calw** (Cursor Claw on [npm](https://www.npmjs.com/package/cursor-calw), repo [`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw)) is **solo-authored**. There is no “Cursor” contributor org here—just this maintainer. Issues and **small, focused PRs** are welcome if they match the project’s scope and quality bar.

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

1. Fork **`cursor-calw`** → branch from **`main`** (or work in a clone if you’re the maintainer).
2. `npm ci` (CI uses the same lockfile discipline).
3. Keep changes **narrow** unless **kariemSeiam** has agreed to a larger refactor.

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

New behavior warrants tests or a deliberate exception noted in the PR description.

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

- Short motivation + behavioral summary so intent is obvious.
- `Fixes #nnn` hooks when applicable.
- User-visible changes logged under **[CHANGELOG.md](CHANGELOG.md) `[Unreleased]`** when appropriate.

Conduct: **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**

---

## Releases (author)

Tag-driven publish per [`.github/workflows/publish.yml`](.github/workflows/publish.yml): push **`v*`** tags after versioning `package.json` and consolidating **CHANGELOG**.

```bash
git tag v1.x.x && git push origin v1.x.x
```

Configure **`NPM_TOKEN`** with publish capability for **`cursor-calw`**.
