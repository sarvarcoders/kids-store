# AGENTS.md

## Project

This repository is a Telegram-first online store for children's clothing.

## Development order

Implement major product areas in this order:

1. Telegram channel integration
2. Telegram bot
3. Telegram Mini App
4. Admin panel
5. AI assistant
6. Public website

Do not start a later product area unless the user explicitly requests it.
The current repository contains only the initial bot, database, shared package,
and documentation skeleton. In particular, do not add a Mini App, admin panel,
AI features, or a website without an explicit request.

## Repository structure

- Telegram bot: `apps/bot`
- PostgreSQL and Prisma: `packages/database`
- Shared validation schemas and types: `packages/shared`
- Project documentation: `docs`

## Technology

- Node.js
- TypeScript
- pnpm workspaces
- PostgreSQL
- Prisma ORM
- grammY
- Zod
- Next.js for future web-based product areas only

## Coding rules

- Keep TypeScript in strict mode and use ESM.
- Do not use `any`.
- Split code into small, understandable modules with explicit exports.
- Add appropriate validation for every new function. Always validate
  environment variables and untrusted or external input with Zod.
- Add explicit error handling to important operations.
- Use grammY for Telegram bot functionality.
- Write all user-facing bot text in Uzbek.
- Store and display prices in Uzbek so‘m.
- Store monetary database values as integers, never floating-point values.
- Access PostgreSQL through Prisma.
- Commit Prisma schemas and migrations, but never generated Prisma Client files.
- Keep reusable, domain-independent schemas and types in `packages/shared`.
- Add each dependency to the package that directly uses it.
- Update `README.md` or `docs` when setup or architecture changes.

## Safety

- Never commit `.env`, credentials, or real secrets.
- Never hardcode Telegram bot tokens or OpenAI API keys.
- Read all tokens and secrets from environment variables.
- Update `.env.example` whenever a required environment variable is added.
- Validate all user-provided data before using or persisting it.

## Required workflow

For every task:

1. Inspect the existing code first.
2. Create and communicate a plan.
3. Change only the files required for the task.
4. Run `pnpm typecheck` and `pnpm lint`.
5. List every changed file in the final response.
6. Report all errors honestly; never hide failed or unavailable checks.

If a required command is not configured yet, state that clearly instead of
silently skipping it.

## Common commands

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint` (when configured)
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:deploy`
- `pnpm db:studio`


## Git workflow

Har bir muvaffaqiyatli vazifa yakunida:

1. `git status` bilan o‘zgarishlarni tekshir.
2. Faqat ushbu vazifaga tegishli fayllarni stage qil.
3. Typecheck, lint, test va kerakli build muvaffaqiyatli o‘tganidan keyin commit qil.
4. Commit xabari Conventional Commits formatida bo‘lsin.
5. Joriy branchni `origin`ga push qil.
6. Push muvaffaqiyatsiz bo‘lsa, xatoni yashirma va hisobotda ko‘rsat.
7. `.env`, token, parol, generated Prisma Client yoki boshqa maxfiy fayllarni hech qachon stage yoki commit qilma.
8. Boshqa foydalanuvchining unrelated o‘zgarishlarini commit qilma.
9. `main` branchga force push qilma.
10. Yakuniy hisobotda commit hash, commit xabari, branch va push holatini ko‘rsat.
