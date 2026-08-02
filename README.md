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

Admin panel launcher uchun root `.env` ichida allowlist va production HTTPS URL
sozlanadi:

```dotenv
ADMIN_TELEGRAM_IDS=123456789,987654321
ADMIN_APP_URL=https://kids-store-admin-lyart.vercel.app
```

Allowlistdagi foydalanuvchi `/admin` komandasini yuborganda bot
`⚙️ Admin panel` Web App tugmasini ko‘rsatadi. Botning mavjud
`🛍 Do‘kon` default menu tugmasi o‘zgarmaydi.

`REDIS_URL` sozlanganda tugallanmagan bot checkout sessioni 24 soat saqlanadi
va process restartidan keyin tiklanadi. Redis sozlanmagan lokal developmentda
session memory fallback’da qoladi va restartda yo‘qoladi. Database’ga yozilgan
buyurtmalar har ikki holatda ham saqlanib qoladi.

## Telegram Mini App

`apps/mini-app/.env.local` faylini qo‘lda yarating:

```dotenv
TELEGRAM_BOT_TOKEN=
ADMIN_TELEGRAM_ID=
DATABASE_URL=
NEXT_PUBLIC_MINI_APP_URL=http://localhost:3000
MINI_APP_DEV_MODE=true
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_STORAGE_BUCKET=product-images
```

```bash
pnpm dev:mini-app
```

Mini App raw `Telegram.WebApp.initData`ni serverga yuboradi. Server Telegram
hash, `auth_date` va user JSON’ni tekshiradi. `initDataUnsafe` auth manbasi
emas. Mock user faqat `NODE_ENV=development` va `MINI_APP_DEV_MODE=true`
bo‘lganda ishlaydi; production’da bypass yopiq.

Mini App Vercel environmentida `SUPABASE_URL` va
`SUPABASE_STORAGE_BUCKET` Next Image allowlistini build vaqtida aniq bucket
host/path bilan cheklaydi. `SUPABASE_SERVICE_ROLE_KEY` Mini App’ga kerak emas.

Mini App katalog, persistent cart, checkout va order history’ni taqdim etadi.
Checkout narx va stockni database’dan transaction ichida qayta o‘qiydi,
stockni atomic kamaytiradi va idempotency key bilan duplicate orderni
to‘xtatadi.

### Performance konfiguratsiyasi

Production reliability uchun bot, Mini App va Admin bir xil Redis cluster’dan
foydalanadi. TLS yoqilgan `rediss://` URL tavsiya qilinadi; Redis eviction
policy `noeviction` bo‘lishi kerak:

```dotenv
REDIS_URL=rediss://<redis-host>:<port>
REDIS_KEY_PREFIX=kids-store
CACHE_REVALIDATION_SECRET=<kamida-32-belgili-tasodifiy-secret>
CATALOG_REVALIDATION_URL=https://<mini-app-domain>/api/internal/catalog/revalidate
```

`REDIS_URL` berilganda cart/checkout/publish/admin mutation rate-limitlari
instance’lar orasida umumiy bo‘ladi, bot conversation sessionlari 24 soat
saqlanadi va admin mutation idempotency distributed lock bilan ishlaydi.
Mini App checkout notificationlarini Redis queue’ga yozadi; bot processi ularni
5 ta parallel worker bilan yuboradi, exponential backoff asosida 4 marta
urinadi va oxirgi xatoni dead-letter queue’da saqlaydi. Redis sozlanmagan lokal
developmentda mavjud to‘g‘ridan-to‘g‘ri notification va in-memory fallback
ishlashda davom etadi.

Upstash TCP endpointi doim TLS bilan ishlaydi, shuning uchun connection string
`rediss://` bilan boshlanishi kerak. Runtime eski `redis://*.upstash.io` qiymatini
xavfsiz tarzda `rediss://`ga o‘tkazadi; yangi Railway environmentlarda esa
Upstash Console ko‘rsatgan `rediss://` connection stringni to‘g‘ridan-to‘g‘ri
kiriting.

Product, category yoki stock o‘zgarganda katalog cache’i secure internal route
orqali darhol invalidatsiya qilinadi. `CACHE_REVALIDATION_SECRET` Mini App,
Admin va bot environmentlarida bir xil; `CATALOG_REVALIDATION_URL` esa Admin
va botda Mini App production endpointiga qarashi kerak. Secret client bundle’ga
chiqmaydi.

Mini App bosh sahifasi authenticated `GET /api/catalog` orqali user,
kategoriyalar, birinchi mahsulot sahifasi, chegirmali mahsulotlar va cart
quantity’ni bitta requestda oladi. Authenticated response doim `no-store`;
userga bog‘liq bo‘lmagan catalog query natijalari serverda 60 soniya cache
qilinadi. Cart va checkout mutationlari hech qachon cache qilinmaydi.

Bot `@grammyjs/runner` bilan ko‘pi bilan 10 ta update’ni parallel qayta
ishlaydi. Bitta Telegram user update’lari session race condition bo‘lmasligi
uchun ketma-ket bajariladi. Telegram 429, vaqtinchalik 5xx va network xatolari
cheklangan auto-retry bilan boshqariladi.

### Railway bot deploy

Telegram bot Railway’da alohida persistent service sifatida ishlaydi. Service
repository rootidan build qilinadi va Railway service sozlamasidagi Config File
yo‘li `/railway.bot.json` bo‘lishi kerak. `pnpm install`ni build commandga
qo‘shmang: Railpack workspace dependencylarini o‘zi o‘rnatadi.

```bash
pnpm --filter @kids-store/bot build
pnpm --filter @kids-store/bot start
```

Bot `prebuild` lifecycle’i core paketini, core esa database va shared
paketlarini build qiladi. Database `prebuild` jarayonida Prisma Client avtomatik
generate qilinadi. Notification worker bot processining ichida ishga tushadi;
`REDIS_URL` mavjud bo‘lsa queue, retry va dead-letter oqimini boshqaradi. Railway
service replica sonini `1` qiling: grammY long polling uchun bir token bilan
bitta faol poller ishlashi kerak. Deploy yoki restart paytida `SIGTERM` runner,
worker queue’lari, Redis ulanishlari va Prisma Client’ni tartibli yopadi.

Vercel serverless runtime uchun `DATABASE_URL` Supabase Supavisor transaction
pooler manzili bo‘lishi kerak; migration va introspection uchun `DIRECT_URL`
saqlanadi. Har process Prisma/pg pool limiti:

```dotenv
DATABASE_POOL_MAX=5
```

`GET /api/catalog` 12 ta asosiy, 6 ta chegirmali mahsulot va ko‘pi bilan 100 ta
kategoriyani qaytaradi. Qolgan mahsulotlar eski paginated `GET /api/products`
orqali olinadi. Response `X-Catalog-Gzip-Bytes` va `Server-Timing` bilan
o‘lchanadi; regression testi 100 KB gzip limitini tekshiradi.

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
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=product-images
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

Mahsulot yaratishda admin telefondan 1–8 ta JPEG, PNG yoki WebP rasm tanlaydi.
Brauzer rasmni eng katta tomoni 1600px bo‘lguncha kichraytirib WebP yoki
optimallashtirilgan JPEG qiladi; server 3 MB limit, MIME va magic bytes’ni
qayta tekshiradi. Fayl server-only service-role orqali public
`product-images` bucket’iga
`products/<product-id-yoki-temp>/<timestamp>-<random>.<format>` yo‘lida
yuklanadi. Database faqat stable public HTTPS URL va `sortOrder`ni saqlaydi.

`SUPABASE_SERVICE_ROLE_KEY` hech qachon `NEXT_PUBLIC_` prefiksi bilan
berilmasin. Bucket mavjud bo‘lmasa birinchi upload uni public va image-only
limitlar bilan yaratishga urinadi; mavjud bucket private bo‘lsa upload xavfsiz
rad etiladi. Forma bekor qilinganda draft rasmlar tozalanadi. Brauzer kutilmagan
yopilib qolgan holat uchun `products/temp/` obyektlarini vaqti-vaqti bilan
Storage lifecycle yoki alohida maintenance job orqali tozalash tavsiya etiladi.
Oldingi `placehold.co` va `images.unsplash.com` URL’lari backward compatibility
uchun saqlanadi; yangi asosiy flow gallery/camera upload hisoblanadi.

### Vercel monorepo deploy

1. Vercel project Root Directory qiymatini `apps/admin` qiling.
2. `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`,
   `TELEGRAM_BOT_USERNAME`, `ADMIN_TELEGRAM_IDS` va kuchli
   `ADMIN_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` va
   `SUPABASE_STORAGE_BUCKET`ni server Environment Variables sifatida kiriting.
3. Faqat public URL’ni `NEXT_PUBLIC_ADMIN_URL` sifatida kiriting.
4. Botdagi admin Web App tugmasini production HTTPS URL’ga ulang.
5. `AdminAuditLog` migration production database’ga deploy qilinganidan keyin
   panelni ishga tushiring.

Admin mutation rate-limit va idempotency Redis sozlanganda barcha serverless
instance’lar orasida umumiy ishlaydi. Database transaction, unique constraint
va conditional order status update data integrity’ni saqlaydi.

## Tekshiruv va build

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:mini-app-bundle
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
