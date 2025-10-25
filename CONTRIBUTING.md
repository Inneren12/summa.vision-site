# Contributing

## Local setup

Install dependencies with `npm install`. Husky hooks are installed automatically via the `prepare` script. If hooks are missing (for example after cloning with `--no-optional`), run `npm run prepare` manually.

## Commit hygiene

We gate pull requests on formatted diffs and Conventional Commits. To avoid CI failures:

- Use `npm run lint:staged` before committing to format staged files with Prettier and fix issues reported by ESLint.
- Follow the Conventional Commits specification (e.g. `feat: add hero animation`, `fix(web): guard undefined token`).
- Validate commit messages locally with `npm run commitlint -- --from HEAD~1 --to HEAD`.

CI runs `lint:staged` through Husky’s `pre-commit` hook and rejects non-conformant messages with commitlint on every push and pull request.

## Need help?

If you hit a false positive or need an exception, ping the maintainers in the pull request. Document the reason in the PR description so reviewers understand the deviation.
