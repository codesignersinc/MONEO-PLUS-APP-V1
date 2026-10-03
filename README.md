# MONEO+

App de finanzas personales: movimientos, cuentas, presupuesto, ahorros, deudas, inversiones,
suscripciones, pagos programados, juntas (ahorro grupal), reportes y multimoneda.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (base de
datos + autenticación) · Netlify (despliegue).

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

## Estructura

```
src/
├── app/
│   ├── finanzas/          # La aplicación (una carpeta por sección)
│   ├── home/              # Landing / lista de espera (hoy redirige a /finanzas)
│   ├── login/ register/   # Autenticación
│   └── auth/callback/     # Callback OAuth de Supabase
├── components/
│   ├── finance/           # Sidebar, MobileNav, AddTransactionModal…
│   ├── notifications/     # Campana y panel de notificaciones
│   └── ui/                # Toast, LoadError, logos, imágenes
├── contexts/              # AuthContext
├── lib/                   # Capa de datos (servicios Supabase) y utilidades
│   ├── supabase/          # Clientes de Supabase (browser y server)
│   ├── supabaseFinance.ts # Cuentas, movimientos, presupuesto, ahorros, deudas, inversiones, suscripciones
│   ├── supabaseJuntas.ts  # Juntas
│   ├── supabaseCurrency.ts# Monedas y tipos de cambio
│   ├── dataError.ts       # Normalización de errores
│   └── financeStore.ts    # Tipos del dominio y categorías
└── middleware.ts          # Refresco de sesión de Supabase
supabase/migrations/       # Esquema SQL, en orden por fecha
```

## Base de datos

El esquema vive en `supabase/migrations/`. Cada cambio de esquema es un archivo nuevo con
prefijo de fecha (`YYYYMMDDHHMMSS_descripcion.sql`); no se editan migraciones ya aplicadas.

## Flujo de trabajo

1. Crea una rama desde `main`.
2. Antes de subir: `npm run format && npm run lint && npm run type-check`.
3. Abre un pull request. CI (GitHub Actions) ejecuta formato, lint, tipos y build.
4. Al fusionar en `main`, Netlify despliega.
