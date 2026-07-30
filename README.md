# Kids Store

Bolalar kiyimlari sotadigan Telegram do‘kon uchun boshlang‘ich monorepo.

## Texnologiyalar

- Node.js va TypeScript
- pnpm workspaces
- grammY
- Next.js App Router, React va Tailwind CSS
- PostgreSQL
- Prisma ORM
- Zod

## Tuzilma

```text
.
├── apps/
│   ├── bot/               # Telegram bot
│   └── mini-app/          # Telegram Mini App katalogi
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
qiymatlarini kiriting. Root `.env` bot va Prisma CLI entrypointlari uchun
ishlatiladi; Mini App runtime root `.env` faylini bevosita o‘qimaydi.

Prisma Client’ni generatsiya qiling:

```bash
pnpm db:generate
```

## Ishga tushirish

Development rejimida botni ishga tushirish:

```bash
pnpm dev
```

`pnpm dev` faqat Telegram botni ishga tushiradi.

Bot `/start` komandasida bosh menyuni ko‘rsatadi. Mahsulotni Telegram deep link
orqali ochish uchun quyidagi format ishlatiladi:

```text
https://t.me/<bot_username>?start=product_<product_id>
```

Admin mahsulotni Telegram kanaliga chiqarishi uchun:

```text
/publish <product_id>
```

Mahsulot variantini tanlash va tugallanmagan buyurtma holati hozircha process
memory’sida saqlanadi. Bot qayta ishga tushganda tugallanmagan checkout session
yo‘qoladi; tasdiqlanib database’ga yozilgan buyurtmalar saqlanib qoladi.

Buyurtma oqimi: o‘lcham va rang → miqdor → telefon → yetkazib berish manzili →
yakuniy tasdiqlash. Telefonni Telegram contact tugmasi yoki matn orqali yuborish
mumkin.

## Telegram Mini App

Mini App hozircha xavfsiz Telegram autentifikatsiyasi va read-only mahsulot
katalogini taqdim etadi. Savatcha va Mini App orqali buyurtma yaratish keyingi
bosqichga qoldirilgan.

Next.js lokal development uchun `apps/mini-app/.env.local` faylini qo‘lda
yarating:

```dotenv
TELEGRAM_BOT_TOKEN=
DATABASE_URL=
NEXT_PUBLIC_MINI_APP_URL=http://localhost:3000
MINI_APP_DEV_MODE=true
```

Bu fayl Git tomonidan ignore qilinadi. Haqiqiy token yoki database manzilini
commit qilmang. `DIRECT_URL` Mini App runtime qiymati emas; u root `.env` orqali
faqat Prisma migration, introspection va generate jarayonlarida ishlatiladi.
Root `.env` qiymatlarini `.env.local`ga avtomatik nusxalovchi script mavjud
emas.

Keyin Mini App’ni alohida ishga tushiring:

```bash
pnpm dev:mini-app
```

Local manzil odatda `http://localhost:3000`. Mock user faqat
`NODE_ENV=development` va `MINI_APP_DEV_MODE=true` bo‘lganda ishlaydi.
Production build va `next start` rejimida bu bypass yopiq.

Real Telegram ichida sinash uchun:

1. Mini App’ni HTTPS manzilga joylashtiring.
2. Shu manzilni Vercel Project Environment Variables ichida
   `NEXT_PUBLIC_MINI_APP_URL` sifatida kiriting.
3. BotFather orqali botning Mini App yoki menu button URL’ini shu HTTPS
   manzilga sozlang.
4. Vercel’da `TELEGRAM_BOT_TOKEN`, `DATABASE_URL` va Prisma build uchun
   `DIRECT_URL` server qiymatlarini kiriting; `MINI_APP_DEV_MODE=false` qiling.
5. Mini App’ni Telegram ichidagi tugmadan oching.

Frontend raw `Telegram.WebApp.initData`ni API’ga yuboradi. Server hash,
`auth_date` va Telegram user JSON’ini tekshirgandan keyingina katalog
endpointlariga ruxsat beradi. `initDataUnsafe` autentifikatsiya uchun
ishlatilmaydi va bot tokeni client bundle’ga uzatilmaydi.

Read-only endpointlar:

```text
GET /api/auth/me
GET /api/categories
GET /api/products
GET /api/products/:id
```

Products endpoint `category`, `search`, `discountOnly`, `page` va `limit`
query parametrlarini qo‘llaydi.

Build va production rejimi:

```bash
pnpm build
pnpm start
```

Faqat Mini App production build:

```bash
pnpm build:mini-app
```

TypeScript tekshiruvi:

```bash
pnpm typecheck
pnpm typecheck:mini-app
```

Lint, test va to‘liq build:

```bash
pnpm lint
pnpm lint:mini-app
pnpm test
pnpm build
```

Prisma komandalar:

```bash
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm db:studio
```

Hozircha Mini App savatchasi, admin panel, AI va public website mavjud emas.
