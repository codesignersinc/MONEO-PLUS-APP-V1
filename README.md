# MONEO+

App de finanzas personales: movimientos, cuentas, presupuesto, ahorros, deudas, inversiones,
suscripciones, pagos programados, juntas (ahorro grupal), reportes y multimoneda.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (base de
datos + autenticación) · Vercel (despliegue).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa las claves de Supabase
npm run dev                  # http://localhost:4028
```

### Variables de entorno

| Variable                        | Dónde obtenerla                              |
| ------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API → URL      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key |

## Scripts

| Comando              | Qué hace                                        |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Servidor de desarrollo en el puerto 4028        |
| `npm run build`      | Build de producción (falla con errores TS/lint) |
| `npm start`          | Sirve el build de producción                    |
| `npm run lint`       | ESLint (`lint:fix` para autocorregir)           |
| `npm run type-check` | Verificación de tipos con TypeScript            |
| `npm run format`     | Formatea con Prettier (`format:check` en CI)    |
| `npm test`           | Pruebas unitarias con Vitest                    |

## Estructura

```
src/
├── app/
│   ├── finanzas/          # La aplicación (una carpeta por sección)
│   ├── home/              # Landing / lista de espera (hoy redirige a /finanzas)
│   ├── login/ register/   # Autenticación
│   ├── privacidad/ terminos/ # Textos legales (borradores pendientes de revisión legal)
│   └── auth/callback/     # Callback OAuth de Supabase
├── components/
│   ├── finance/           # Sidebar, MobileNav, AddTransactionModal, TransferForm, AccountAmountPicker…
│   ├── notifications/     # Campana y panel de notificaciones
│   └── ui/                # Toast, LoadError, logos, imágenes
├── contexts/              # AuthContext
├── lib/                   # Capa de datos (servicios Supabase) y utilidades
│   ├── supabase/          # Clientes de Supabase (browser y server)
│   ├── supabaseFinance.ts # Cuentas, movimientos, transferencias, presupuesto, ahorros, deudas, inversiones, suscripciones
│   ├── supabaseObligations.ts # Pagos e ingresos por cobrar
│   ├── accountDeletion.ts # Eliminar cuenta (Edge Function)
│   ├── currency.ts dates.ts # Utilidades de moneda y fechas locales
│   ├── supabaseJuntas.ts  # Juntas
│   ├── supabaseCurrency.ts# Monedas y tipos de cambio
│   ├── dataError.ts       # Normalización de errores
│   └── financeStore.ts    # Tipos del dominio y categorías
└── middleware.ts          # Refresco de sesión de Supabase
supabase/migrations/       # Esquema SQL, en orden por fecha
supabase/tests/            # Pruebas SQL (se ejecutan contra staging y terminan en ROLLBACK)
supabase/functions/        # Edge Functions (Deno): delete-account
```

## Base de datos

El esquema vive en `supabase/migrations/`. Cada cambio de esquema es un archivo nuevo con
prefijo de fecha (`YYYYMMDDHHMMSS_descripcion.sql`); no se editan migraciones ya aplicadas.
Cada versión aplicada se registra en `supabase_migrations.schema_migrations`.

Entornos: **staging** (proyecto Supabase `moneo-staging`, usado por Vercel Preview) y
**producción**. Toda migración se aplica y prueba primero en staging.

### Motor de saldo

`accounts.balance` lo mantiene PostgreSQL; el cliente no puede editarlo:

- Triggers de `transactions`: gasto resta, ingreso suma, cada pata de transferencia aplica su
  signo; editar revierte y vuelve a aplicar, borrar revierte; sin cuenta no afecta. Los
  movimientos anteriores al motor (`balance_applied = false`) nunca mueven saldo.
- Triggers de `currency_exchanges`: la conversión resta `from_amount` del origen y suma
  `to_amount` al destino. Las conversiones no se editan.
- `adjust_account_balance(cuenta, saldo, motivo)`: ajuste manual, auditado en
  `account_balance_adjustments`.
- Transferencias: tabla `transfers` con dos patas en `transactions` (`out` negativa, `in`
  positiva); solo con `create_transfer` / `update_transfer` / `delete_transfer`.
- Pagos e ingresos: pendiente no mueve saldo; `mark_pago_paid` / `mark_income_collected`
  crean el movimiento en la cuenta elegida y lo vinculan (`transaction_id`);
  `mark_*_pending` lo borra por id.

### Pruebas SQL

`supabase/tests/*.test.sql` se ejecutan como `postgres` en el SQL Editor de **staging** (o con
`psql`). Crean usuarios y datos de prueba dentro de una transacción que termina en `ROLLBACK`;
la tabla final debe mostrar `ok = true` en todas las filas.

### Edge Functions

`delete-account` elimina la cuenta del usuario y todos sus datos (bloquea si organiza una
Junta activa). Despliegue: `supabase functions deploy delete-account --project-ref <ref>`.

## Flujo de trabajo

1. Crea una rama desde `main`.
2. Antes de subir: `npm run format && npm run lint && npm run type-check && npm test`.
3. Abre un pull request. CI (GitHub Actions) ejecuta formato, lint, tipos y build.
4. Al fusionar en `main`, Vercel despliega a producción (cada PR genera un preview).
