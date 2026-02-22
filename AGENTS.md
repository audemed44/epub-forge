# Repository Guidelines

## Project Structure & Module Organization
This repository is an npm workspace monorepo:

- `apps/api`: Express + TypeScript backend (`src/server.ts`, `src/routes`, `src/jobs`).
- `apps/web`: React + Vite frontend (`src/features`, `src/components/ui`, `src/shared`).
- `packages/core`: Shared parsing/build logic used by the API (`src/parsers`, `src/service.ts`).
- `vendor/WebToEpub`: Upstream WebToEpub codebase that inspired this project.
- `scripts/smoke.mjs`: End-to-end smoke checks against a live local server.
- `.github/workflows`: CI and publish workflows.
- Runtime data defaults to `./.data` locally (or `/data` in Docker).

Use `vendor/WebToEpub` as a behavioral reference when implementing or debugging parser logic and EPUB-building behavior, especially when a user asks for parity with existing WebToEpub behavior.

## Build, Test, and Development Commands
- `npm install`: Install workspace dependencies.
- `npm run dev`: Start one-port local dev server at `http://localhost:3000` (API + Vite middleware).
- `npm run build`: Build the web app for production.
- `npm start`: Start the API server in production-style mode.
- `npm run typecheck`: Run strict TypeScript checks across `core`, `api`, and `web`.
- `npm run test:smoke`: Run API/UI smoke checks (`/api/health`, root HTML, build-jobs endpoints).
- `docker compose up --build`: Run the full stack in Docker.

## Coding Style & Naming Conventions
- Language: TypeScript (ESM, NodeNext). Keep code `strict`-safe (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Indentation: 2 spaces; keep imports explicit with `.js` extensions where required by ESM.
- Naming: `camelCase` for variables/functions, `PascalCase` for React components, descriptive file names (`queueService.ts`, `BuilderTab.tsx`).
- Follow existing feature grouping in web (`features/*`, `shared/*`) and parser-first organization in core.

## Testing Guidelines
- Current automated test gate is smoke testing via `npm run test:smoke`; CI runs `typecheck`, `build`, then smoke tests.
- Add/extend smoke assertions when introducing endpoints or queue behavior changes.
- Keep tests deterministic: avoid external-site dependencies and prefer local API contracts.

## Commit & Pull Request Guidelines
- Use Conventional Commit style seen in history: `feat: ...`, `feat(web): ...`, `fix: ...`, `refactor: ...`, `chore: ...`, `ci: ...`.
- Keep commits focused and scoped to one change area.
- Branch workflow:
  - Before creating a task branch, checkout `main` and pull the latest changes from `origin/main`.
  - Each new chat/task must start on a new branch created from up-to-date `main`.
  - If `main` moves ahead while working, rebase your branch onto `main` before opening/updating the PR.
  - Merge to `main` only by merging a GitHub PR.
  - Do not merge branches into `main` locally.
  - If a local merge to `main` happens accidentally, stop and ask how to proceed.
- PRs should include:
  - Clear summary of behavior changes.
  - Linked issue/context when applicable.
  - Validation notes (commands run, e.g., `npm run typecheck && npm run test:smoke`).
