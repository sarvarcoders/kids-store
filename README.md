# Kids Store

Bolalar kiyimlari sotadigan Telegram do‘kon uchun boshlang‘ich monorepo.

## Texnologiyalar

- Node.js va TypeScript
- pnpm workspaces
- grammY
- PostgreSQL
- Prisma ORM
- Zod

## Tuzilma

```text
.
├── apps/
│   └── bot/               # Telegram bot
├── packages/
│   ├── database/          # Prisma va PostgreSQL qatlami
│   └── shared/            # Umumiy sxema va turlar
└── docs/                  # Loyiha hujjatlari
```

## Talablar

- Node.js 24 yoki undan yangi
- pnpm 11 yoki undan yangi
- Ishlayotgan PostgreSQL serveri
- BotFather orqali olingan Telegram bot tokeni

## O‘rnatish

```bash
pnpm install
cp .env.example .env
```

Windows PowerShell uchun:

```powershell
pnpm install
Copy-Item .env.example .env
```

Keyin `.env` ichidagi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`,
`TELEGRAM_BOT_USERNAME`, `ADMIN_TELEGRAM_ID`, `DATABASE_URL` va `DIRECT_URL`
qiymatlarini kiriting.

Prisma Client’ni generatsiya qiling:

```bash
pnpm db:generate
```

## Ishga tushirish

Development rejimida botni ishga tushirish:

```bash
pnpm dev
```

Bot `/start` komandasida bosh menyuni ko‘rsatadi. Mahsulotni Telegram deep link
orqali ochish uchun quyidagi format ishlatiladi:

```text
https://t.me/<bot_username>?start=product_<product_id>
```

Admin mahsulotni Telegram kanaliga chiqarishi uchun:

```text
/publish <product_id>
```

Mahsulot variantini tanlash holati hozircha process memory’sida saqlanadi va
bot qayta ishga tushganda tozalanadi.

Build va production rejimi:

```bash
pnpm build
pnpm start
```

TypeScript tekshiruvi:

```bash
pnpm typecheck
```

Prisma komandalar:

```bash
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm db:studio
```

Hozircha Mini App, admin panel, AI va website mavjud emas.
