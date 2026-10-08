# MONEO NEGOCIO — diagnóstico, decisiones y plan

> Estado: **aprobado. Fases 1, 2 y 3 en producción; fase 4 lista (beta: admins y quien ya tenga un negocio; para todos con `NEXT_PUBLIC_NEGOCIO=true`).** Fecha: 8 de octubre de 2026.
> Territorio: «Entender las finanzas de tu negocio sin complicarte». No es contabilidad, ERP,
> POS, CRM, planilla ni facturación electrónica.

## 1. Diagnóstico (auditoría del 8 de octubre de 2026)

- **No existía ninguna estructura de espacio, negocio u organización.** Todo pertenece a una
  persona por `user_id` y RLS `user_id = auth.uid()`. Lo más parecido es MONEO HOGAR
  (`households` + `household_members`, RLS con `is_household_member`): su patrón sirve para
  socios en el futuro.
- **Motor de saldos** (no se duplica): `transactions_guard` + `transactions_apply_balance`,
  `transfers_validate` + `transfers_sync_legs`, `currency_exchanges_*`, `adjust_account_balance`.
- **Pagos y cobros**: `pagos` / `income_entries` con `mark_pago_paid`, `mark_income_collected`
  (crean el movimiento con `obligation_create_tx`, guardan `transaction_id`, generan el
  siguiente si es recurrente).
- **MONEO AUTO**: `auto_suggestions` → confirmación → movimiento; `auto_rules` (comercio →
  cuenta/categoría); lectores de correo, comprobante (`parseReceipt`, OCR en el dispositivo),
  texto libre (`parseFreeText`) y voucher.
- **Resumen**: `moneo_summary` / `moneo_upcoming` (Inicio, MONEO Mini, widget).
- **Categorías**: texto + `CATEGORY_PRESETS` (sin tabla).
- **No existían**: clientes, proveedores, empleados, inventario, exportar CSV/PDF, WhatsApp.

## 2. Decisiones del titular

| #   | Tema                                      | Decisión                                                                            |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Patrimonio personal                       | **Excluye el negocio**; el negocio se ve aparte                                     |
| 2   | Moneda del negocio (V1)                   | **La misma que la moneda principal** del usuario                                    |
| 3   | Empleados                                 | **Pagos recurrentes** con un contacto de tipo «empleado»; sin planilla              |
| 4   | Juntas, Hogar, Metas, Deudas, Inversiones | **Solo en Personal** por ahora                                                      |
| 5   | Lanzamiento                               | **Beta gratis** detrás de una bandera; el precio después                            |
| 6   | Cambio de contexto                        | Interruptor **Personal \| Negocio** siempre visible (arriba en Inicio y en el menú) |

## 3. Separación Personal / Negocio

- **La cuenta define el contexto.** `accounts.business_id` (NULL = Personal). Todo movimiento
  hereda el contexto de su cuenta **en la base de datos** (trigger): el cliente nunca lo envía.
- Pagos, cobros, suscripciones y presupuestos llevan su propio `business_id` (existen antes de
  tocar una cuenta). Al marcarlos pagados/cobrados, la cuenta debe ser del mismo contexto.
- **Personal = `business_id IS NULL`** en todos los servicios y en las funciones SQL de resumen.
- Dinero entre contextos: solo con **transferencias** («Retiro del negocio» / «Aporte al
  negocio»), fuera de ingresos y gastos de ambos lados.
- El contexto de una cuenta no cambia si ya tiene movimientos.
- Hogar y Deudas solo aceptan movimientos personales (trigger).
- Rutas: `/finanzas` = Personal; `/finanzas/negocio/[id]/…` = Negocio.

## 4. Modelo de datos (fase 1)

- `businesses` (dueño, nombre, rubro). RLS solo dueño. Máximo 5 por usuario.
- `business_parties` (negocio, tipo `proveedor` | `cliente` | `empleado`, nombre, teléfono,
  correo, notas, monto y frecuencia habitual para empleados).
- `business_id` en `accounts`, `transactions`, `pagos`, `income_entries`, `subscriptions`,
  `budget_categories`; `party_id` en `transactions`, `pagos`, `income_entries`.
- `business_summary(negocio, desde, hasta)`: resultado del periodo y del anterior, caja,
  por cobrar, por pagar, comprometido, proyección, gastos por categoría y serie de 6 meses.

### Fórmula de la proyección (centralizada en `business_summary`)

Ingresos y gastos **por caja** (lo cobrado y lo pagado), sin devengo.

```
cierre_estimado = caja_hoy
                + cobros pendientes que vencen hasta fin de mes
                - pagos pendientes que vencen hasta fin de mes (incluye empleados)
                - suscripciones del negocio que vencen hasta fin de mes
```

`caja_hoy` = saldo de las cuentas del negocio que no son de crédito ni inversión, en la
moneda principal. Cada supuesto se muestra al usuario para que el número sea verificable.

## 5. Fases

| Fase | Contenido                                                                                                                                                                                                | Base de datos |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1    | Esquema base, invariantes, `business_summary`, resúmenes personales sin negocio, todas las consultas personales con `business_id IS NULL`, pruebas SQL. Invisible (bandera apagada)                      | Sí            |
| 2    | Interruptor, crear negocio, dashboard del negocio, cuentas del negocio, retiro/aporte                                                                                                                    | No            |
| 3    | Registro rápido con proveedor/cliente; pagos y cobros del negocio; empleados; «Vega me pagó 5,000» con vista previa (si hay un cobro pendiente, se marca cobrado); foto de comprobante con el OCR actual | No            |
| 4    | Proveedores, clientes y equipo con pagado, pendiente y último movimiento                                                                                                                                 | No            |
| 5    | Reportes del negocio, exportar CSV y PDF, insights con datos reales                                                                                                                                      | No            |
| 6    | MONEO AUTO hacia cuentas del negocio, catálogo/inventario liviano (opcional por negocio), plan de pago, socios                                                                                           | Sí            |

## 6. Notas del boceto (pantallas 1–10)

- Proyección: no sumar ingresos ni restar gastos ya realizados (la caja ya los incluye).
- «Vega me pagó 5,000»: si Vega tiene un cobro pendiente, se ofrece marcarlo cobrado.
- No prometer «IA» hasta tenerla; WhatsApp como «Próximamente» o oculto.
- Caja: separar lo que tienes (disponible) de lo que te deben y lo que debes.
- Sin emojis; iniciales en lugar de fotos de empleados y logos de terceros.
- Inventario: fase 6 y opcional. Exportar: CSV primero.

## 7. Pendientes para la fase 2

- Un retiro o aporte muestra su pata personal en Movimientos: editarlo desde Personal debe ser
  de solo lectura (la otra cuenta es del negocio) o abrir la edición desde el negocio.
- Selectores de cuenta de Hogar, Juntas y Deudas: solo cuentas personales (la base de datos
  ya rechaza movimientos del negocio en Hogar y Deudas).
- Configuración → «Tus datos» cuenta todos los registros, también los del negocio (es un
  total de la cuenta, no una vista personal).

## 8. Fase 3 (hecha)

- Cobros y clientes, Pagos y proveedores: pendientes, «Cobrar»/«Pagar» con una cuenta del negocio
  (mark_income_collected / mark_pago_paid), y totales por contacto (pendiente, este mes, último).
- Equipo: empleado = contacto con sueldo mensual + pago recurrente (día de pago). Sin planilla.
  V1 solo mensual; quincenal/semanal más adelante.
- «Escríbelo como lo dirías» (`src/lib/businessText.ts`, reglas, sin IA): si el contacto tiene un
  pendiente por el mismo monto, se marca cobrado/pagado en lugar de contarlo dos veces.
- Foto del comprobante: OCR en el dispositivo (`readImageText` + `parseReceipt`) + número de
  comprobante (F001-3256) en la nota; el comercio se asocia al proveedor existente si coincide.

## 9. Fase 4 (hecha)

- Directorio `/finanzas/negocio/[id]/contactos`: clientes, proveedores y equipo con búsqueda,
  filtro por tipo y lo pendiente con cada uno; alta de contacto.
- Ficha `/contactos/[partyId]`: teléfono (llamar), WhatsApp (celular peruano de 9 dígitos → +51),
  correo, notas; te debe / le debes, este mes, total, último movimiento; pendientes con
  Cobrar/Pagar; historial; editar, marcar inactivo y eliminar (el historial se conserva).
