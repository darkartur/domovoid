# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start          # start the agent locally
npm run tsc            # type-check all packages
npm run lint           # eslint
npm run lint:fix       # eslint --fix, run after each change; you can also use `npx eslint --fix <file>`
npm run fmt            # prettier write, run after each change; you can also use `npx prettier --write <file>`
npm run knip           # unused exports / unlisted / unused deps. Run after all changes are done as a final check
npm run depcheck       # version consistency across workspaces
npm run depfix         # auto-fix version mismatches, use it if spotted problems
npm run test           # Playwright E2E tests — MUST pass before work is done
```

We don't have any build step yet, but you already can use node to execute typescript directly:

```bash
node packages/<pkg>/index.ts
```

All checks listed above must pass before work is done, after any work always make sure you run all of the checks and they pass.

**When checks fail, fix the root cause. Never:**

- Suppress tsc errors with `@ts-ignore`, `@ts-expect-error`, or `as any`
- Disable ESLint rules with `eslint-disable` comments
- Add entries to `knip.config.ts` `ignoreDependencies` to silence knip

## Architecture

npm workspaces monorepo. All packages live under `packages/`.

**Packages:**

- `@domovoid/core` — core AI agent runtime
- `@domovoid/integration-telegram` — Telegram integration
- `@domovoid/integration-github` — GitHub integration

## Adding dependencies

After `npm install`, re-run `knip` and `syncpack:check` to confirm clean state.
