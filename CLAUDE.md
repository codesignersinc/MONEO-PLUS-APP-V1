# CLAUDE.md

Guía para trabajar en este repositorio. Ver `README.md` para la estructura completa.

## Proyecto

MONEO+: app de finanzas personales en Next.js 15 (App Router) + React 19 + TypeScript +
Tailwind, con Supabase como backend y Vercel como hosting. La UI está en español (Perú,
moneda base PEN).

## Comandos

- `npm run dev` — desarrollo en http://localhost:4028
- `npm run format` / `npm run format:check` — Prettier
- `npm run lint` — ESLint
- `npm run type-check` — TypeScript
- `npm run build` — build de producción (falla con errores de tipos o lint)
- `npm test` — pruebas unitarias (Vitest, `src/**/*.test.ts`)

Antes de hacer commit, deben pasar `format:check`, `lint`, `type-check`, `build` y `test`. CI los
ejecuta en cada pull request (`.github/workflows/ci.yml`). Las pruebas SQL
(`supabase/tests/*.test.sql`) se ejecutan contra staging y terminan en `ROLLBACK`. Para `build` local sin `.env.local`, define
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con valores de prueba.

## Convenciones

- **Acceso a datos solo en `src/lib/`**. Las páginas llaman a servicios
  (`accountsService`, `transactionsService`, `transfersService`, `subscriptionsService`, … en
  `supabaseFinance.ts`; pagos e ingresos en `supabaseObligations.ts`; juntas en
  `supabaseJuntas.ts`; monedas en `supabaseCurrency.ts`). No llamar a Supabase directamente
  desde componentes.
- **Errores**: los servicios resuelven con datos reales o lanzan `DataError`
  (`src/lib/dataError.ts`). Un array vacío significa "sin registros", nunca "falló".
  En la UI: `LoadError` para fallos de carga, `useToast().showError(err)` para acciones,
  `getErrorMessage(err)` para mensajes en formularios.
- **Montos**: los gastos se guardan con monto negativo y `type: 'gasto'`; ingresos positivos.
  Transferencias: dos patas `transferencia` (`out` negativa, `in` positiva).
- **Multimoneda**: `amount` va en la moneda de la cuenta; `original_amount` en `currency_code`
  (moneda original) y `base_amount` en `base_currency_code`, todos con signo. Arma estos campos
  con `buildCurrencyFields`; la tasa se guarda y nunca se recalcula con tasas actuales.
- **Saldos (motor en PostgreSQL)**: nunca calcules ni escribas `accounts.balance` desde el
  cliente (no hay permiso de UPDATE sobre esa columna). Los triggers de `transactions` y
  `currency_exchanges` lo mueven; el ajuste manual es `accountsService.adjustBalance`
  (auditado). Transferencias solo con `transfersService` (nunca editar/borrar una pata suelta).
  Pagos/ingresos: `status` y `transaction_id` solo cambian con `pagosService.markPaid`/
  `markPending` e `incomeService.markCollected`/`markPending`.
- **Cuentas**: todo selector de cuenta de un movimiento nuevo viene con la primera cuenta
  registrada preseleccionada (`accountsService.getAll()` ordena por `created_at`), visible y
  editable; en transferencias/conversiones el destino es otra cuenta. Al editar se conserva la
  cuenta del movimiento.
- **pg_trigger_depth()**: en triggers BEFORE distingue sentencia directa (= 1) de la hecha por
  el sistema (> 1, incluidas acciones referenciales). En triggers AFTER de una acción
  referencial vale 1: no lo uses ahí.
- **Fechas**: columnas `DATE` como `YYYY-MM-DD`. Construye fechas locales con
  `new Date(str + 'T00:00:00')` y evita `toISOString()` para obtener el día (desfase UTC): usa
  `todayLocal` / `localDateTimeToISO` de `src/lib/dates.ts`. `transaction_date` es
  `timestamptz`: envía fecha y hora locales, no `YYYY-MM-DD`.
- **Tipos del dominio** en `src/lib/financeStore.ts`; categorías en `CATEGORY_PRESETS`.
- **Estilo**: Prettier (comillas simples, ancho 100). Componentes de página con `'use client'`.
  Iconos de `lucide-react`. Alias de import `@/` → `src/`.
- **Migraciones**: nuevo archivo en `supabase/migrations/` con prefijo de fecha; no editar
  migraciones existentes. Se aplican primero en staging (`moneo-staging`) y se registran en
  `supabase_migrations.schema_migrations`; producción solo con aprobación explícita.
- **Privacidad**: no guardar texto bruto de notificaciones/correos; los logs no llevan montos,
  comercios, cuentas, ids ni contenido.

## Deuda técnica conocida

- `src/app/finanzas/page.tsx` (~1.300 líneas) y `src/components/finance/MobileNav.tsx`
  (~1.300) son muy grandes; `MobileNav` duplica la creación de gastos en lugar de usar
  `AddTransactionModal`.
- Quedan ~60 warnings de ESLint (sobre todo `no-explicit-any` y variables sin usar).
- Las pruebas unitarias cubren utilidades puras; no hay pruebas de componentes ni E2E.
- `/privacidad` y `/terminos` tienen texto completo (titular en `src/lib/legal.ts`), pero aún no
  tienen revisión de un abogado. Actualízalos si cambia el tratamiento de datos o los planes.
- `next build` falla al prerenderizar si faltan `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (el cliente de Supabase se crea durante el render). En
  Vercel deben estar definidas también para el entorno **Preview**, no solo Production.
