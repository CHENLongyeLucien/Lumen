# Contributing to Lumen

Thanks for helping! Lumen is small on purpose, so changes should keep it fast, private and dependency-free at runtime.

## Setup

```sh
pnpm install
pnpm dev        # rebuilds dist/ on change
```

Load `dist/` with **Load unpacked** in `chrome://extensions`, and click **Reload** there after changing the service worker or the manifest.

## Before opening a pull request

Run the same checks as CI. Every one must pass:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then follow the relevant steps of the manual test guide in the [README](README.md#manual-test-guide).

## Guidelines

- **TypeScript strict, no `any`.** Prefer runtime checks (`$as(selector, HTMLInputElement)`, type guards) over type assertions.
- **No `eslint-disable`** unless a comment on the same line explains why.
- **Keep logic pure and tested.** Put anything that doesn't need the DOM (parsing, formatting, rules) in its own module, with unit tests in `tests/`. UI modules should only wire events to that logic.
- **Small files.** Split a module once it grows beyond about 300 lines or mixes several features.
- **No new runtime dependencies, network calls, telemetry or permissions** without discussing it in an issue first. Dev dependencies are fine when they earn their place.
- **Accessibility:** every control needs an accessible name, a visible focus ring and a keyboard path. Animations must respect `prefers-reduced-motion`.
- **Comments and identifiers in English.**

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`, `chore:`. Keep each commit focused on one change.
