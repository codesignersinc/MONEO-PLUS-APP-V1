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

- ~~Un retiro o aporte muestra su pata personal en Movimientos~~ (hecho, §11).
- ~~Selectores de cuenta de Hogar, Juntas y Deudas: solo cuentas personales~~: todos usan
  `accountsService.getAll()` (`business_id IS NULL`); la base de datos además rechaza
  movimientos del negocio en Hogar y Deudas. Juntas no enlaza movimientos en la base.
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

## 10. Fase 5 (hecha)

- Reporte `/finanzas/negocio/[id]/reportes` (menú del negocio y atajos del dashboard), con el mismo
  filtro de periodo del dashboard: ingresos, gastos, resultado y margen contra el periodo anterior
  (totales de `business_summary`); flujo de 6 meses con tabla; ingresos y gastos por categoría;
  clientes que más pagaron y proveedores a los que más se pagó; equipo, ingresos sin cliente,
  retiros y aportes, gasto más grande, caja, por cobrar y por pagar.
- Desglose y frases en `src/lib/businessReport.ts` (puro, con pruebas). Las frases solo aparecen
  si los datos las sostienen (máx. 5): resultado y margen, cambio de ingresos, dependencia de un
  cliente (≥ 30%), retiros (y si superan lo ganado), categoría principal de gasto, equipo.
- Retiro / aporte = pata de transferencia cuya otra pata está en Personal; si ambas patas son de
  cuentas del mismo negocio, es un movimiento interno y no cuenta.
- **CSV**: cada movimiento del periodo (fecha y hora local, tipo, categoría, descripción,
  contacto, cuenta, monto con signo, moneda de la cuenta, monto en la moneda principal, notas).
  UTF-8 con BOM para Excel; las celdas de texto que empiezan con `= + - @` llevan `'` delante
  (evita fórmulas inyectadas). Se genera en el dispositivo, sin servidor.
- **PDF**: «Guardar como PDF» del navegador (`window.print()`), sin librerías. En impresión, una
  página con `.print-area` imprime solo esa zona, en blanco y con colores sólidos; el título de la
  página sugiere el nombre del archivo. El pie aclara que es un reporte de gestión, no un estado
  financiero ni un servicio contable.
- `bizMovementsService.list(id, { from, to, partyId })`: los límites del periodo se envían como
  días locales (antes `from` se comparaba en UTC).

## 11. Cierre de la beta (hecho)

- **Precio (decisión del titular)**: MONEO NEGOCIO está incluido en MONEO PLUS **pagado** (plan
  propio —mensual, anual, pase, de por vida— o un lugar en Duo/Familiar); la prueba gratis sin
  tarjeta no lo incluye. `usePlus().business` y `src/app/finanzas/negocio/layout.tsx` muestran el
  candado; los datos se conservan. Donde los planes no están activos (`ONBOARDING_V2` apagado) no
  se bloquea nada, como el resto de PLUS. «MONEO NEGOCIO» figura en `PLUS_BENEFITS`.
- **Beta abierta**: `NEXT_PUBLIC_NEGOCIO=true` en Vercel (lo activó el titular).
- **Retiro / aporte en Personal**: al editar se avisa que la descripción, fecha y nota cambian en
  ambos lados; al eliminar se pide confirmación (también desaparece del negocio).
- **Equipo quincenal**: dos pagos mensuales recurrentes (mitad el 15 y mitad el último día). El
  pago semanal llegó con la fase 6 (§12).
- **Legal**: Términos §6 «MONEO NEGOCIO» (no es servicio contable, tributario ni laboral; datos de
  terceros) y §4 (solo con plan pagado); Privacidad: datos del negocio y de contactos, MONEO+
  como encargado, conservación al eliminar contactos y solicitudes de terceros.

## 12. Fase 6 (hecha) — migración `20261021120000_moneo_negocio_fase6.sql`

- **Crear un negocio exige PLUS pagado también en la base**: `businesses_guard` (ahora SECURITY
  DEFINER) llama a `user_has_paid_plus(owner)` = `user_has_plus` sin la prueba gratis
  (`billing_plans.kind = 'trial'`), con los lugares de Duo/Familiar. No se expone al cliente. Los
  negocios existentes no se tocan.
- **Pagos semanales**: `pagos.every_days` (7 o 14, solo recurrentes). `mark_pago_paid` no cambia:
  el trigger `pagos_inherit_context` mueve la siguiente instancia a `payment_date + every_days` y
  conserva negocio, contacto y frecuencia. Equipo: «Semanal» con día de la semana
  (`nextWeekday`); el total mensual usa `monthlyPay` (× 52 / 12). La proyección del mes solo
  cuenta la próxima instancia pendiente (como el resto de recurrentes).
- **MONEO AUTO hacia el negocio** (sin cambios en la base): en «Registrar», las cuentas del negocio
  aparecen agrupadas («Negocio · nombre») si hay acceso a NEGOCIO. Con una cuenta del negocio se
  usan las categorías del negocio, se propone el comercio como proveedor/cliente
  (`partiesService.ensure`) y se registra con `bizMovementsService.create` (el contexto lo pone la
  cuenta). La regla de tarjeta recuerda la cuenta del negocio; la de categoría se guarda con la
  clave `<negocio>:<comercio>` para no mezclarse con las personales. Sin opción de hogar.
- Portada `BANNER-negocios.jpg` (`NegocioBanner`) en el dashboard, en «Crea tu negocio» y en el
  candado; se recorta en móviles y no se imprime.
- Pruebas: `supabase/tests/moneo_negocio_fase6.test.sql` (18) y la base de la fase 1 ahora crea
  sus usuarios con PLUS pagado.
