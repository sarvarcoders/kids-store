# Kids Store

Bolalar kiyimlari uchun Telegram-first internet do‘kon monoreposi.

## Texnologiyalar

- Node.js 24+, TypeScript strict va ESM
- pnpm workspaces
- grammY
- Next.js App Router, React va Tailwind CSS
- PostgreSQL, Prisma ORM va Zod

## Tuzilma

```text
.
├── apps/
│   ├── bot/               # Telegram bot
│   ├── mini-app/          # Telegram Mini App
│   └── admin/             # Xavfsiz Admin Panel
├── packages/
│   ├── core/              # Server-only umumiy auth/publish/notification
│   ├── database/          # Prisma va PostgreSQL
│   └── shared/            # Umumiy Zod schema va turlar
└── docs/
```

## O‘rnatish

```bash
pnpm install
cp .env.example .env
pnpm db:generate
```

Windows PowerShell:

```powershell
pnpm install
Copy-Item .env.example .env
pnpm db:generate
```

Root `.env` bot va Prisma CLI uchun ishlatiladi. Haqiqiy token, database URL,
parol yoki session secretni Git’ga commit qilmang.

## Telegram bot

```bash
pnpm dev
```

`pnpm dev` faqat botni ishga tushiradi. Product deep link formati:

```text
https://t.me/<bot_username>?start=product_<product_id>
```

Admin kanal publish komandasi:

```text
/publish <product_id>
```

Tugallanmagan bot checkout sessioni process memory’sida saqlanadi va restartda
yo‘qoladi. Database’ga yozilgan buyurtmalar saqlanib qoladi.

## Telegram Mini App

`apps/mini-app/.env.local` faylini qo‘lda yarating:

```dotenv
TELEGRAM_BOT_TOKEN=
ADMIN_TELEGRAM_ID=
DATABASE_URL=
NEXT_PUBLIC_MINI_APP_URL=http://localhost:3000
MINI_APP_DEV_MODE=true
```

```bash
pnpm dev:mini-app
```

Mini App raw `Telegram.WebApp.initData`ni serverga yuboradi. Server Telegram
hash, `auth_date` va user JSON’ni tekshiradi. `initDataUnsafe` auth manbasi
emas. Mock user faqat `NODE_ENV=development` va `MINI_APP_DEV_MODE=true`
bo‘lganda ishlaydi; production’da bypass yopiq.

Mini App katalog, persistent cart, checkout va order history’ni taqdim etadi.
Checkout narx va stockni database’dan transaction ichida qayta o‘qiydi,
stockni atomic kamaytiradi va idempotency key bilan duplicate orderni
to‘xtatadi.

## Admin panel

Admin panel dashboard, mahsulotlar, kategoriyalar, buyurtmalar, mijozlar,
kanal postlari, append-only audit log va sozlamalarni taqdim etadi.

`apps/admin/.env.local` faylini qo‘lda yarating:

```dotenv
DATABASE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
TELEGRAM_BOT_USERNAME=
ADMIN_TELEGRAM_IDS=123456789,987654321
ADMIN_SESSION_SECRET=
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
```

`ADMIN_SESSION_SECRET` kamida 32 belgili, tasodifiy va production uchun alohida
qiymat bo‘lsin. `ADMIN_TELEGRAM_IDS` vergul bilan ajratilgan musbat Telegram
IDlaridir. `.env.local` Git tomonidan ignore qilinadi.

```bash
pnpm dev:admin
```

Admin panel odatda `http://localhost:3001` da ishlaydi. Login serverda Telegram
`initData`ni tekshiradi, user ID allowlistda bo‘lsa 30 daqiqalik imzolangan
HttpOnly cookie beradi. Cookie raw initData’ni saqlamaydi. Mutationlar CSRF,
rate limit va idempotency key bilan himoyalangan.

MVP’da production auth bypass va parolli login yo‘q. Oddiy browser orqali
kirish o‘rniga admin panelni botdagi alohida Telegram Web App tugmasidan
oching. Keyingi browser auth SSO yoki passkey bilan alohida xavfsizlik auditi
asosida rejalashtiriladi.

Rasm boshqaruvi HTTPS URL’ni saqlaydi, tashqi URL’ni serverdan fetch qilmaydi.
MVP allowlisti `placehold.co` va `images.unsplash.com` hostlari bilan
cheklangan.

### Vercel monorepo deploy

1. Vercel project Root Directory qiymatini `apps/admin` qiling.
2. `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`,
   `TELEGRAM_BOT_USERNAME`, `ADMIN_TELEGRAM_IDS` va kuchli
   `ADMIN_SESSION_SECRET`ni server Environment Variables sifatida kiriting.
3. Faqat public URL’ni `NEXT_PUBLIC_ADMIN_URL` sifatida kiriting.
4. Botdagi admin Web App tugmasini production HTTPS URL’ga ulang.
5. `AdminAuditLog` migration production database’ga deploy qilinganidan keyin
   panelni ishga tushiring.

In-memory rate limit va idempotency cache serverless instansiyalar orasida
umumiy emas. Katta production deployment uchun Redis kabi shared storage
tavsiya qilinadi. Database transaction, unique constraint va conditional order
status update data integrity’ni saqlaydi.

## Tekshiruv va build

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Alohida ilovalar:

```bash
pnpm typecheck:mini-app
pnpm lint:mini-app
pnpm build:mini-app

pnpm typecheck:admin
pnpm lint:admin
pnpm test:admin
pnpm build:admin
```

Prisma:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:deploy
pnpm db:status
pnpm db:seed
pnpm db:studio
```

AI assistant va public website hozircha mavjud emas.
