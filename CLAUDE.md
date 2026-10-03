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

Antes de hacer commit, deben pasar `format:check`, `lint` y `type-check`. CI los ejecuta en
cada pull request (`.github/workflows/ci.yml`). Para `build` local sin `.env.local`, define
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` con valores de prueba.

## Convenciones

- **Acceso a datos solo en `src/lib/`**. Las páginas llaman a servicios
  (`accountsService`, `transactionsService`, `subscriptionsService`, … en `supabaseFinance.ts`;
  juntas en `supabaseJuntas.ts`; monedas en `supabaseCurrency.ts`). No llamar a Supabase
  directamente desde componentes.
- **Errores**: los servicios resuelven con datos reales o lanzan `DataError`
  (`src/lib/dataError.ts`). Un array vacío significa "sin registros", nunca "falló".
  En la UI: `LoadError` para fallos de carga, `useToast().showError(err)` para acciones,
  `getErrorMessage(err)` para mensajes en formularios.
- **Montos**: los gastos se guardan con monto negativo y `type: 'gasto'`; ingresos positivos.
- **Fechas**: columnas `DATE` como `YYYY-MM-DD`. Construye fechas locales con
  `new Date(str + 'T00:00:00')` y evita `toISOString()` para obtener el día (desfase UTC).
- **Tipos del dominio** en `src/lib/financeStore.ts`; categorías en `CATEGORY_PRESETS`.
- **Estilo**: Prettier (comillas simples, ancho 100). Componentes de página con `'use client'`.
  Iconos de `lucide-react`. Alias de import `@/` → `src/`.
- **Migraciones**: nuevo archivo en `supabase/migrations/` con prefijo de fecha; no editar
  migraciones existentes.

## Deuda técnica conocida

- `src/app/finanzas/page.tsx` (~1.300 líneas) y `src/components/finance/MobileNav.tsx`
  (~1.000) son muy grandes; `MobileNav` duplica la creación de movimientos en lugar de usar
  `AddTransactionModal`.
- Quedan ~65 warnings de ESLint (sobre todo `no-explicit-any` y variables sin usar).
- No hay pruebas automatizadas.
- `next build` falla al prerenderizar si faltan `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (el cliente de Supabase se crea durante el render). En
  Vercel deben estar definidas también para el entorno **Preview**, no solo Production.
