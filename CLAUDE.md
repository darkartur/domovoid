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

## Testing strategy

### End-to-end tests

End-to-end tests are written with [Playwright](https://playwright.dev/) and located in `tests/` directory.
**We do NOT use browsers.** Tests run via Playwright's Node.js API only — never install or launch browser binaries (`npx playwright install` is forbidden).
They are criticial for any agentic work, this rules are important and should never be ignored:

- Whenever you planning a new feature, first describe it in a form of e2e test
- ALWAYS run test after you wrote one, test is not written until you run it
- Test is not considered functional if you never seen it fail
- Feature is not considered functional if you never saw test for it pass
- When you plan changes to the feature, plan changes to the test first, than confirm that test fails, than implement the feature, than confirm that test passes
- It always benefitial to do small iterations on test and the feature. Do changes in small steps, one small change in the test, confirm failure, follow with minimal implementation, confirming test result, than repeat.

## Architecture

npm workspaces monorepo. All packages live under `packages/`.

**Packages:**

- `@domovoid/core` — core AI agent runtime
- `@domovoid/integration-telegram` — Telegram integration
- `@domovoid/integration-github` — GitHub integration

## Adding dependencies

Always add dependencies to the specific package that uses them (`packages/<pkg>/package.json`), not the root `package.json`.
After `npm install`, re-run `knip` and `syncpack:check` to confirm clean state.
