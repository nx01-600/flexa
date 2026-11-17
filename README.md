<p align="center">
  <img src="public/flexa-logo.svg" alt="Flexa" width="240">
</p>

<p align="center"><b>Get paid for the days you already worked.</b></p>

---

## What is Flexa

Flexa is an **earned wage access** platform for Colombia. Workers can withdraw part of the salary they have already earned before payday, straight to their bank or wallet (Bancolombia, Davivienda, Nequi, Daviplata...). Companies connect their payroll, set the rules and see how their teams use the benefit.

It has two surfaces:

| Surface | Route | For | Main screens |
|---|---|---|---|
| Worker app | `/app` | Employees (mobile, 430 px column) | Home with available balance, withdraw, movements, finances, services, receipts, help, profile |
| Flexa Empresas | `/empresas` | HR / payroll teams (desktop) | Dashboard, payroll uploads, workers, stats, returns, settings |

## Status

Full stack. The frontend talks to the **FLEXA API** in [`backend/`](backend/README.md) (NestJS + PostgreSQL + Prisma), which covers the 10 modules of the scope document and four roles:

| Surface | Route | Role |
|---|---|---|
| Worker app | `/app` | Trabajador |
| Flexa Empresas | `/empresas` | Talento Humano (admin) and Finanzas (read-only) |
| Consola FLEXA | `/admin` | Administrador FLEXA |

## Run it

```bash
# API (needs Docker for PostgreSQL)
# .env must exist BEFORE npm install: the postinstall step (prisma generate) reads DATABASE_URL from it.
cd backend && cp .env.example .env && npm install && docker compose up -d
npx prisma migrate dev && npx prisma db seed && npm run start:dev   # :4000

# Frontend
cd .. && npm install
echo NEXT_PUBLIC_API_URL=http://localhost:4000/api > .env.local
npm run dev   # :3000
```

Demo accounts, password `Flexa2026!`: worker cédula `1234567890` (Valentina Torres), `rrhh@empresa.com`, `finanzas@empresa.com`, `admin@flexa.co`.

Workers sign up with their cédula, the corporate email their company loaded and a password. `/auth/login` and `/auth/register` are rate limited (`THROTTLE_LIMIT` per minute per IP, default 20). See [`backend/README.md`](backend/README.md) for all environment variables.

## Project structure

```
backend/        FLEXA API (NestJS, Prisma, PostgreSQL)
app/
  admin/        FLEXA internal console
  app/          worker app (login, (tabs), retirar, comprobante, servicios, ayuda)
  empresas/     company panel (login, (panel)/nomina, trabajadores, estadisticas, ...)
  globals.css   design tokens (colors, radii, fonts)
components/
  flexa/        product components (Logo, BottomNav, Receipt, Kpi, Table, ...)
  ui/           shadcn/ui primitives (Base UI)
lib/
  api.ts        API client, session per surface, useApi hook
  mock.ts       legacy prototype data (only the avatar helper is still used)
public/         logo, avatars, static assets
```
