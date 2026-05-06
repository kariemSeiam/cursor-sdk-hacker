# Changelog · Cursor Claw (`cursor-calw`)

> Pack line: **[`kariemSeiam/cursor-calw`](https://github.com/kariemSeiam/cursor-calw)** · npm **`cursor-calw`** · MIT.

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as reflected in `package.json`. The **Swarm CLI** (`ca3`) reads its displayed version from root `package.json`.

## [Unreleased]

### Changed

- Documentation spine for agents & humans: **`AGENTS.md`**, **[`docs/README.md`](docs/README.md)** (catalog + Markdown voice covenant); refreshed **CONTRIBUTING**, **CODE_OF_CONDUCT**, **examples/README**, and canonical headers on **`docs/*.md`**.
- Project **renamed to Cursor Claw**; GitHub repository: [kariemSeiam/cursor-calw](https://github.com/kariemSeiam/cursor-calw). npm package **`cursor-calw`** (slug matches repo).

### Added

- **Venom Swarm** multi-agent orchestration (`ca3`, `ca3-review`): `swarm`, `fork`, `plan`, `resume`, `status`, `kill`, `clean`, `review`, `merge`, `integrate`, and model listing.
- Documentation: `docs/architecture.md`, `docs/swarm-patterns.md`, `docs/troubleshooting.md`, and this changelog.

### Technical

- Git **detached worktrees** under `$TMPDIR/venom-swarm` for worker isolation.
- JSON **ledger** at `.venom-swarm/ledger.json` for run state and recovery-oriented metadata.
- **Plan mode**: leader-based task decomposition (`decomposer.mjs`) with JSON DAG validation.
- **Rate limiting**: staggered worker batches and retry/backoff (`rate-limiter.mjs`) for 429/464 and transient network errors.
- Optional **integrator** merge path (`integrator.mjs`) and **reviewer** overlap analysis (`reviewer.mjs`).

---

## [1.1.0] — SDK alignment release

### Changed

- **@cursor/sdk** aligned to **v1.0.9+** model parameter system (e.g. `composer-2` with `fast` parameter instead of separate “fast” model IDs).

### Fixed / hardened

- Security and packaging configuration updates (`fix: SDK v1.0.9 model system, security hardening, proper package config`).

---

## [1.0.0] — initial release

### Added

- **`ca`** (`src/ca.mjs`): local SDK agent (`ask`, `code`) and REST API helpers.
- **`ca2`** (`src/ca2.mjs`): ConnectRPC recon against `api2.cursor.sh` (models, account, scan, raw RPC).
- Core documentation: `docs/REVERSE_ENGINEERING.md`, `docs/API_REFERENCE.md`, `docs/METHODS_SCAN.md`.

---

## Version reference (quick)

| Artifact | Version / label | Source |
|----------|-----------------|--------|
| npm package | mirrors `"version"` in `package.json` | `package.json` |
| Swarm CLI banner | same semver string | [`src/ca3.mjs`](src/ca3.mjs) reads root `package.json` at startup |
| Ledger schema | `version: 1` | `Ledger._fresh()` in `src/lib/ledger.mjs` |

When a release is tagged, replace **Unreleased** with the new semver and a date, and move items accordingly.
