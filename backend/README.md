# FLEXA API

Backend de FLEXA: NestJS 12 + PostgreSQL + Prisma 7. Cubre los 10 módulos del documento de alcance y los 4 roles (trabajador, administrador empresarial, usuario financiero, administrador FLEXA).

## Arrancar

```bash
cd backend
npm install
npm run db:up                 # PostgreSQL en localhost:5433
cp .env.example .env
npm run db:migrate            # crea el esquema
npm run db:seed               # datos de demo (npm run db:reset para empezar de cero)
npm run start:dev             # http://localhost:4000/api  ·  Swagger en /api/docs
```

Cuentas de demo (contraseña `Flexa2026!` para todas):

| Rol | Correo |
|---|---|
| Trabajador | `valentina.torres@email.com` |
| Administrador empresarial (Talento Humano) | `rrhh@empresa.com`, `gerencia@empresa.com` |
| Usuario financiero | `finanzas@empresa.com` |
| Administrador FLEXA | `admin@flexa.co` |

El ERP de la empresa de demo envía nómina con la API key `flx_demo_empresa_sa`.

## Cómo funciona

- **Devengado** = salario diario × días trabajados (según nómina y calendario, menos novedades no remuneradas) + horas extra + recargos.
- **Neto** = devengado − salud y pensión (8 %) − otros descuentos proporcionales.
- **Disponible** = `maxAdvancePct` % del neto − lo ya usado en el periodo (retiros, comisiones, pagos de servicios).
- **Recomendado** = `recommendedPct` % del neto − lo usado. Es referencia, no límite.
- **Simulación** no crea nada. **Solicitud** vuelve a validar todo dentro de una transacción con bloqueo por trabajador; si hay advertencias exige `acknowledgeWarnings: true` (409 `ACK_REQUIRED`).
- Las solicitudes que cumplen las reglas se aprueban y desembolsan solas. Las de monto ≥ `exceptionAmount` quedan en `EXCEPTION` para que Talento Humano las apruebe o rechace. Los desembolsos fallidos crean incidencia y se pueden reintentar.
- **Alarma FLEXA** genera alertas al superar `alarmUsagePct` del tope, al llegar a `alarmRequestsCount` retiros o al retirar más del recomendado. Nunca bloquea.
- **Cierre de periodo** consolida lo anticipado por trabajador (compensación). La empresa reporta lo descontado en nómina y FLEXA calcula diferencias; la conciliación solo cierra sin diferencias o con nota explícita.
- Toda operación relevante queda en `AuditLog` (trazabilidad).

Proveedores externos (KYC, fondeo, pagos) son adaptadores sandbox en `src/common/providers.ts`:
documentos terminados en `000` → KYC en revisión manual; cuentas terminadas en `0000` → transferencia rechazada.

## Endpoints (prefijo `/api`, JWT `Bearer` salvo los públicos)

### Auth
| Método | Ruta | |
|---|---|---|
| POST | `/auth/login` | `{email, password, surface?: worker\|company\|admin}` → `{accessToken, user}` |
| POST | `/auth/register` | Trabajador habilitado: `{docNumber, email, password, phone?}` |
| GET | `/auth/me` | |

### Trabajador (`WORKER`) — módulos 1, 2, 3, 4, 10
| Método | Ruta | |
|---|---|---|
| GET/PATCH | `/worker/profile` | Perfil + `onboarding.steps` (registered, kyc, consents, account) |
| GET/POST | `/worker/kyc` | Validación de identidad (`{selfieScore?}`) |
| GET | `/worker/legal` | Términos y autorizaciones con `acceptedAt` |
| POST | `/worker/legal/:id/accept` | |
| GET/POST | `/worker/accounts` | Cuentas de destino `{bank, type: SAVINGS\|CHECKING\|WALLET, number}` |
| POST | `/worker/accounts/:id/default` · DELETE `/worker/accounts/:id` | |
| GET | `/worker/earnings` | Salario, devengado, neto, disponible, recomendado, límites, bloqueos |
| GET | `/worker/earnings/explanation` | Pasos del cálculo del disponible |
| GET | `/worker/earnings/weekly` | Curva del devengado por semana |
| POST | `/worker/simulate` | `{amount}` → recibe, efecto en el siguiente pago, errores, advertencias |
| POST | `/worker/advances` | `{amount, bankAccountId?, acknowledgeWarnings?}` |
| GET | `/worker/advances` · `/worker/advances/:id` | Estado con línea de tiempo (`events`) |
| POST | `/worker/advances/:id/cancel` | Solo en `REQUESTED`/`EXCEPTION` |
| GET | `/worker/receipts/:code` | Comprobante de retiro o pago |
| POST | `/worker/payments` | Pago de servicio o recarga `{kind: PAGO\|RECARGA, category, biller, reference, amount}` |
| GET | `/worker/wellness` | Recomendado vs usado, uso por periodo, consejos |
| GET | `/worker/alerts` · PATCH `/worker/alerts/:id/read` · POST `/worker/alerts/read-all` | Alarma FLEXA |
| GET | `/worker/movements?kind=retiro\|pago\|recarga` | Historial unificado |
| GET | `/worker/documents` · `/worker/history/export` (CSV) | |

### Empresa (`COMPANY_ADMIN` escribe, `COMPANY_FINANCE` consulta) — módulos 5, 7, 10
| Método | Ruta | |
|---|---|---|
| GET | `/company` | Empresa, trabajadores habilitados, suscripción mensual |
| GET/PATCH | `/company/settings` | Reglas: tope, recomendado, mínimos, máximos, solicitudes por periodo, comisión, días de bloqueo, umbrales de alarma y de excepción |
| GET/POST | `/company/sites` · `/company/team` · PATCH `/company/team/:id` | |
| GET | `/company/workers?q&status&siteId&enabled` | Con retirado del periodo |
| GET | `/company/workers/:id` | Ficha completa + EWA del trabajador |
| POST | `/company/workers` · `/company/workers/upload` (CSV) | Registrar / cargar |
| PATCH | `/company/workers/:id` | Información laboral |
| POST | `/company/workers/:id/access` · `/company/workers/access` | Habilitar/deshabilitar `{enabled, reason}` |
| GET/POST | `/company/incidents` · PATCH `/company/incidents/:id` | Incidencias y excepciones |
| GET | `/company/advances?status&periodId&workerId&from&to` · `/company/advances/:id` | Operaciones y trazabilidad |
| POST | `/company/advances/:id/approve` · `/reject` (`{note}`) · `/retry` | Gestión de excepciones |
| GET | `/company/ewa/summary?periodId` | Utilización agregada + reglas aplicadas |
| GET | `/company/audit?entity&entityId` | Trazabilidad |

### Nómina — módulo 6
| Método | Ruta | |
|---|---|---|
| GET/POST | `/payroll/periods` · GET `/payroll/periods/:id` · PATCH `/payroll/periods/:id/budget` | |
| POST | `/payroll/periods/:id/upload` | CSV `documento,salario,dias_trabajados,horas_extra,valor_horas_extra,recargos,deducciones` |
| PATCH | `/payroll/periods/:id/entries/:workerId` | Corrección manual |
| POST | `/payroll/erp/sync` (público, header `x-api-key`) | `{entries: [...]}` desde el ERP |
| POST | `/payroll/integration/api-key` | Genera API key del ERP |
| GET | `/payroll/uploads` · `/payroll/uploads/:id` · PATCH `/payroll/issues/:id/resolve` | Estado e inconsistencias |
| GET/POST | `/payroll/novelties` | Novedades (INCAPACIDAD, VACACIONES, AUSENCIA, RETIRO, AJUSTE_SALARIO, HORAS_EXTRA…) |
| GET | `/payroll/status` | Calidad de datos del periodo: cobertura, faltantes, inconsistencias |

### Compensación y conciliación — módulo 8
| Método | Ruta | |
|---|---|---|
| GET | `/compensation/pending` | Valores pendientes de compensar |
| POST | `/compensation/periods/:id/close` | Consolida lo anticipado por trabajador |
| GET | `/compensation/periods/:id` | Líneas, totales y conciliación |
| GET | `/compensation/periods/:id/export` | CSV para aplicar en nómina |
| POST | `/compensation/periods/:id/applied` | Lo descontado: `{items:[{docNumber, amount}]}` o CSV |
| PATCH | `/compensation/lines/:id` | Resolver diferencia `{compensatedAmount, note}` |
| POST | `/compensation/periods/:id/reconcile` | `{force?, note?}` |
| GET | `/compensation/periods/:id/report` (CSV) · `/compensation/reconciliations` | |

### Payroll Intelligence (`COMPANY_*`) — módulo 9
`/analytics/overview`, `/analytics/payroll`, `/analytics/variations?threshold=20`, `/analytics/trends?limit=6`, `/analytics/compare?a&b`, `/analytics/usage?months=6`, `/analytics/attention`, `/analytics/reports/:type` (CSV: `payroll`, `usage`, `trends`, `variations`). Todos aceptan `periodId`.

### Soporte (todos los roles) — módulo 10
`GET /support/categories`, `GET/POST /support/tickets`, `GET /support/tickets/:id`, `POST /support/tickets/:id/messages`, `PATCH /support/tickets/:id/status`.

### Administrador FLEXA (`FLEXA_ADMIN`)
`/admin/overview`, `/admin/companies` (GET/POST), `/admin/companies/:id` (GET/PATCH), `/admin/companies/:id/settings` (PATCH, parámetros autorizados), `/admin/integrations`, `/admin/incidents` (GET, PATCH `:id`), `/admin/advances` (+ POST `:id/retry`), `/admin/kyc` (cola de revisión manual, POST `:workerId`), `/admin/legal` (GET/POST nueva versión), `/admin/audit`.
