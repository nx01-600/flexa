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

This repository is the **frontend prototype**. It is not connected to any backend yet: every number on screen comes from mock data in [`lib/mock.ts`](lib/mock.ts).

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Project structure

```
app/
  app/          worker app (login, (tabs), retirar, comprobante, servicios, ayuda)
  empresas/     company panel (login, (panel)/nomina, trabajadores, estadisticas, ...)
  globals.css   design tokens (colors, radii, fonts)
components/
  flexa/        product components (Logo, BottomNav, Receipt, Kpi, Table, ...)
  ui/           shadcn/ui primitives (Base UI)
lib/
  mock.ts       simulated data, the contract the backend must replace
public/         logo, avatars, static assets
```

## Backend: what is needed

The backend should replace `lib/mock.ts` with a real API. The mock already describes the data the UI expects:

- **Auth**: worker login and company login (separate roles).
- **Worker**: profile, earned balance, available-to-withdraw amount, weekly earnings (`worker`, `weeklyEarned`).
- **Withdrawals and movements**: create a withdrawal to a bank/wallet, list movements of type `retiro`, `pago`, `recarga` (`movements`, `banks`).
- **Company**: company profile, sites, employees, team members (`company`, `sites`, `employees`, `team`).
- **Payroll**: upload payroll files and track their processing (`payrollUploads`).
- **Analytics**: weekly and monthly withdrawals, by category and by weekday (`companyWeekly`, `monthlyWithdrawn`, `categories`, `weekdayWithdrawals`).

Suggested first step: expose these as REST endpoints with the same shapes as `lib/mock.ts`, so the frontend can switch from mock to API one screen at a time.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui on Base UI, Motion, Recharts, Phosphor and Lucide icons.
