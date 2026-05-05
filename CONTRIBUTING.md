## Contributing

Thanks for improving this project.

### Prerequisites

Node.js compatible with [`package.json`](package.json) `engines` (use `node --version` locally).

### Reporting issues

- Use the repo’s **Issues** tab for reproducible bugs, documentation gaps, or feature ideas.
- Include version of Node (`node -v`), the command you ran, and what happened vs. what you expected.

### Workflow

1. Fork the repo and create a branch from `main` (or the default branch).
2. Install dependencies with `npm ci`.
3. Make focused changes tied to one concern when possible.

### Verification

Before you open a PR, please run:

```bash
npm run lint
npm test
```

Tests use Node’s built-in test runner (`node --test`). New behaviour should ship with automated coverage where reasonable.

### Code style

Linting follows [ESLint](eslint.config.js) with the [`eslint:recommended`](https://eslint.org/docs/latest/rules/) baseline. Prefer matching surrounding patterns rather than rewriting unrelated modules.

Keep secrets out of commits: API keys belong in `.env` (ignored by Git), not in tracked files—see [.env.example](.env.example) for variable names where applicable.

### Pull requests

- Describe the motivation and summarize the behaviour change for reviewers.
- Link related issues (`Fixes #123`) when relevant.
- If you change CLI behaviour or public docs, reflect that in README or `/docs/` as appropriate.

### Releases (maintainers)

Publishing to npm runs from [`.github/workflows/publish.yml`](.github/workflows/publish.yml) when a version tag matching `v*` is pushed (for example after `git tag v1.2.0 && git push origin v1.2.0`). Configure an **NPM_TOKEN** repository secret with a token that has publish access to the package scope.

### Code of Conduct

Interactions in this repository are governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
