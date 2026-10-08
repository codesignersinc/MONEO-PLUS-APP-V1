# MONEO Global Core — mapa, arquitectura y plan

> Estado: **aprobado y en implementación**. Hechos: pasos 1, 2, 3 y 4.
> Fecha: 7 de octubre de 2026.

## 0. Decisiones ya tomadas

- **Perú es el mercado de origen y laboratorio**, no el que define el producto.
- Roadmap: 🇵🇪 Perú → 🇪🇸 España → 🇺🇸 hispanos en EE. UU. → 🇦🇺 Australia / 🇬🇧 Reino Unido → 🇦🇪 Emiratos / 🇸🇬 Singapur. Corea, fuera.
- **Global Core + Paquetes de país (Country Packs)**: nada de «Perú», «S/», «Lima», «BCP» o «Yape» fijo en el código.
- **MONEO es agnóstico al método de captura**: manual → AUTO (correo, notificaciones, OCR, voz) → banca abierta cuando un mercado lo justifique. MONEO AUTO = todo lo que entra solo.
- **El catálogo (bancos, billeteras, servicios) es administrable** desde el panel, sin deploy.
- **Sistema de traducción primero** (español + inglés), traducción completa después; con localización cultural, no solo palabras.
- **La validación internacional corre en paralelo** (landings + lista de espera + anuncios pequeños). Los datos eligen el país.

---

## 1. Mapa: dónde está MONEO «casado» con Perú

Auditoría de solo lectura de `src/`, `supabase/`, `public/` y `android/` (7 de octubre de 2026).

### 1.1 Moneda y formatos

| Hallazgo                                                                                                                                                          | Dónde                                                                                                                                     | Volumen            | Impacto                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------- |
| «S/» literal delante de montos (`S/ {x.toFixed(2)}`), ignora la moneda del usuario                                                                                | reportes (~20), deudas, suscripciones, presupuesto, ingresos, pagos, ahorros, inversiones, calendario, juntas (+3 formateadores copiados) | ~45 archivos       | **Alto**: un usuario en euros ve «S/»           |
| Monto por defecto `'PEN'` (`\|\| 'PEN'`, `useState('PEN')`)                                                                                                       | lib + ~30 componentes                                                                                                                     | ~85 lugares        | Alto                                            |
| `AmountField` con `currency = 'S/'` por defecto; etiquetas «Monto (S/)»                                                                                           | `formKit.tsx:249`, formularios rápidos                                                                                                    | 6                  | Medio                                           |
| `formatCurrency` y `moneyFormatter` arman el texto a mano (`toFixed` + regex / `en-US`); el campo `locale` de cada moneda existe pero no se usa                   | `src/lib/currency.ts`, `src/components/dashboard/ui.tsx`                                                                                  | 2 núcleos, 24 usos | Medio: CLP/COP con decimales, separadores fijos |
| `getCurrencyInfo` cae en PEN si no conoce la moneda; `getDefaultRate` devuelve **1** para pares desconocidos (también en SQL `moneo_fx_rate`)                     | `currency.ts:27,49`, `moneo_summary.sql`                                                                                                  | —                  | **Alto: totales silenciosamente incorrectos**   |
| AUD no está en la lista de monedas                                                                                                                                | `currency.ts`                                                                                                                             | —                  | Bloquea Australia                               |
| Suscripciones, pagos, ingresos, presupuestos, deudas, metas y juntas **no tienen columna de moneda** (se asumen en PEN)                                           | esquema; `supabaseFinance.ts:781-811`                                                                                                     | 7 tablas           | Alto                                            |
| Hogar limita monedas a PEN/USD/EUR (CHECK en SQL y UI)                                                                                                            | `household.sql:34,98`, `CreateHousehold`, `ExpenseSheet`                                                                                  | 4                  | Medio                                           |
| Defaults `'PEN'` en tablas (`accounts`, `transactions`, `user_settings`, `moneo_auto`) y `coalesce(…,'PEN')` en funciones                                         | 6 migraciones                                                                                                                             | ~15                | Medio                                           |
| En el **modo calculadora** del monto, `evalAmount` convierte toda coma en punto decimal: **«1,250» da 1.25** (el campo normal es numérico y no tiene el problema) | `formKit.tsx:192`, `empezar:1250`                                                                                                         | 2                  | **Bug actual también en Perú**                  |

### 1.2 Fechas, idioma y zona horaria

| Hallazgo                                                                                          | Dónde                                                                                                      | Volumen |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `'es-PE'` fijo en `toLocale*String`                                                               | ~25 archivos                                                                                               | 29 usos |
| Arreglos de meses en español escritos a mano (uno usa «set», los demás «sep»)                     | 14 en TS + 1 en Java                                                                                       | 15      |
| Semana empieza el lunes, fijo                                                                     | `calendario`                                                                                               | 1       |
| **Ningún uso de `Intl.*`**; `<html lang="es">`, manifests `es-PE`, OpenGraph `es_PE`, voz `es-PE` | layout, manifests, landing, `VoiceButton`                                                                  | —       |
| `America/Lima` fijo en SQL: el «hoy», el inicio de mes y el día de cada movimiento                | 6 migraciones (incluye `moneo_summary`, motor de transferencias, pagos/ingresos, deudas, avisos del hogar) | 6       |
| Funciones de borde con −5 h fijas                                                                 | `auto-inbound:149`, `mail-oauth:377`                                                                       | 2       |
| Cron de avisos a las 13:00 UTC (= 8:00 Lima)                                                      | `household_payment_reminders`                                                                              | 1       |
| Fechas calculadas en UTC (día equivocado de noche en América)                                     | `supabaseCurrency.ts:94`, `convertir:105`, `householdImport.ts:32`                                         | 3       |
| **No existe columna de zona horaria, país ni idioma** en ningún usuario                           | `user_profiles`, `user_settings`, `onboarding_profiles`                                                    | —       |

### 1.3 Catálogos

| Hallazgo                                                                                                                                     | Dónde                                                           | Volumen                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| Bancos fijos en código (`PERUVIAN_BANKS`) + alias aparte                                                                                     | `src/lib/brands.ts`                                             | 8 bancos, 8 grupos de alias |
| La bienvenida suma 3 más (Pichincha, Yape, Plin) y su propia lista «con MONEO AUTO»                                                          | `empezar/page.tsx:126-134`                                      | 11                          |
| Cuentas usa otra lista (sin billeteras): **inconsistente** con la bienvenida                                                                 | `cuentas/page.tsx:504`                                          | —                           |
| Mapas de nombres de banco duplicados                                                                                                         | `auto/page.tsx`, `AutoLiveListener.tsx`                         | 2 × 6                       |
| 41 servicios de suscripción (7 con logo enlazado desde Wikimedia), todos globales                                                            | `brands.ts`                                                     | 41                          |
| **La institución se guarda como texto libre** (`accounts.institution`, `debts.institution`); el logo se adivina buscando texto               | esquema                                                         | —                           |
| 8 logos de bancos en `public/assets/images`                                                                                                  | —                                                               | 8                           |
| Categorías: 4 listas distintas (presets 14, gasto 8, ingreso 8 ×2, pago 8 ×2) y **se guardan como texto en español** (`'Otros'`, `'Comida'`) | `financeStore.ts`, `quickForms/shared.tsx`, `ingresos`, `pagos` | 4 listas                    |
| Reglas palabra → categoría con marcas peruanas (Wong, Tottus, Luz del Sur, SOAT, predial, combi, lonche…)                                    | `auto/merchant.ts`, `auto/freeText.ts`, `householdImport.ts`    | 3 conjuntos, 29 reglas      |

### 1.4 Captura de datos (MONEO AUTO)

| Canal real                   | Se guarda como                                 | Nota                                     |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Reenvío de correo (Postmark) | `source='email'`                               | —                                        |
| Gmail conectado              | `source='email'`                               | **Indistinguible** del reenvío           |
| Texto pegado                 | `source='text'`                                | —                                        |
| Captura o boleta (OCR)       | `source='text'`                                | No se registra que fue OCR ni qué lector |
| Voz                          | `source='text'` (o solo rellena un formulario) | Voz en `es-PE` fijo                      |
| Notificaciones Android / SMS | existen en el tipo, **nada las produce**       | Pendiente (lector de notificaciones)     |
| Banca abierta                | no existe                                      | —                                        |

- `bank` y `kind` son listas cerradas en SQL con nombres peruanos (`yape_enviado`, `plin_recibido`).
- Remitentes de confianza (6 dominios `.pe`), paquetes de apps y palabras de OCR están en código, y además copiados en las funciones de borde (`interpreter.js` ×2) y en el cliente.
- `transactions` **no guarda de dónde vino** el movimiento.
- Solo se aceptan montos en PEN o USD en los lectores.

### 1.5 Cobros

- Solo Mercado Pago Perú, con una sola credencial y medios peruanos (tarjeta, Yape, PagoEfectivo, DNI).
- `billing_plans.code` es clave primaria: **un plan = un precio = una moneda**. No hay precios por país.
- Precios escritos a mano en la interfaz («S/ 8.13 al mes», «S/ 97.50», «IGV incluido») en `PlusGate`, `TrialEndedModal`, `Paywall`, `empezar`, `plus`.
- La meta de bienvenida `ahorrar_1000` («Ahorrar S/1,000») tiene la moneda metida en un valor de la base de datos.
- **La landing dice que todo es gratis («S/ 0»)**, en contradicción con MONEO PLUS. **Bug actual.**

### 1.6 Legal

- Titular persona natural con DNI; Ley 29733; Código del Consumidor; «se rigen por las leyes del Perú».
- **Falta el Libro de Reclamaciones**, obligatorio en Perú para negocios que atienden a consumidores, incluidos los digitales. **Pendiente actual.**
- No hay RGPD, CCPA ni Privacy Act de Australia.

### 1.7 Textos e idiomas

- Sin librería de traducción, sin rutas por idioma, sin hreflang, **sin `sitemap` ni `robots`**.
- Unos **2,000–2,500 textos en español** en ~123 archivos. Los más grandes: bienvenida (`empezar`), landing (dos secciones), Hogar, privacidad, MONEO AUTO, Configuración.
- **83 mensajes de error distintos en SQL** que se muestran tal cual al usuario.
- Notificaciones creadas en SQL en español (bienvenida, avisos del hogar).
- La app Android tiene todos sus textos fijos en los layouts y en Java (no en `strings.xml`).
- Tono: «tú» en todo, español latinoamericano casi neutro; lo peruano está en ejemplos y marcas (Yape, «Gasté 35 soles en taxi», bodegas, juntas).

### 1.8 Ya está bien encaminado

- Motor multimoneda (cuentas y movimientos con moneda original y base, tasa guardada).
- `billing_plans.currency` existe; el webhook ya valida moneda.
- `moneo_summary` centraliza los números de Inicio, Mini y widgets: cambiar la zona horaria ahí arregla las tres superficies.
- `onboarding_profiles` y `user_settings` son el lugar natural para país, idioma y zona horaria.
- El modo «Próximamente en Google Play» de la landing es un buen modelo para la lista de espera.

---

## 2. Arreglos que conviene hacer ya (sirven a Perú hoy)

Independientes del plan multipaís; pequeños y sin riesgo:

1. **«1,250» da 1.25 en el modo calculadora** del monto: aceptar coma de miles y coma o punto decimal según el idioma.
2. **Landing «todo gratis / S/ 0»**: alinearla con los planes PLUS reales.
3. **Pares de moneda sin tasa = 1**: avisar al usuario y pedir la tasa, en vez de sumar 1:1 en silencio.
4. **Libro de Reclamaciones** virtual (requisito legal en Perú): necesita tus datos de contacto y responsable.
5. **Mapas de bancos inconsistentes** entre bienvenida y Cuentas (Yape y Plin no aparecen en Cuentas).

---

## 3. Arquitectura propuesta

### 3.1 Contexto del usuario

```
user_settings
 ├── country_code      'PE' | 'ES' | 'US' | …          (ISO 3166-1)
 ├── locale            'es-PE' | 'es-ES' | 'en-AU' | …  (BCP 47)
 ├── timezone          'America/Lima' | 'Europe/Madrid' | …  (IANA)
 └── base_currency_code  ya existe                      (ISO 4217)
```

- Usuarios actuales: `PE`, `es-PE`, `America/Lima`, `PEN`. **Sin cambio visible.**
- **Detección en el registro**: país por la IP (cabecera `x-vercel-ip-country`), idioma del navegador, zona horaria del dispositivo. Se **propone y se confirma** en un toque; nunca se impone. Se puede cambiar en Configuración.

### 3.2 Paquete de país (`countries`)

Tabla administrable desde el panel:

| Campo                                         | Ejemplo PE                                     | Ejemplo ES                              |
| --------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| `code`                                        | PE                                             | ES                                      |
| `default_currency`                            | PEN                                            | EUR                                     |
| `default_locale`                              | es-PE                                          | es-ES                                   |
| `default_timezone`                            | America/Lima                                   | Europe/Madrid                           |
| `week_start`                                  | lunes                                          | lunes                                   |
| `tax_label`, `tax_rate`, `prices_include_tax` | IGV 18 %, sí                                   | IVA 21 %, sí                            |
| `status`                                      | `live`                                         | `hidden` → `waitlist` → `beta` → `live` |
| `features` (jsonb)                            | `{ "juntas": true, "juntas_label": "Juntas" }` | `{ "juntas": false }`                   |
| `legal_profile`                               | `pe`                                           | `eu`                                    |

El paquete de país es la suma de: esta fila + su catálogo (3.3) + sus categorías y reglas (3.4) + sus textos (3.5) + sus precios (3.7) + sus documentos legales (3.8).

### 3.3 Catálogo MONEO (administrable)

```
catalog_entities            la marca: nombre, slug, tipo, logo, colores, web, estado
catalog_entity_countries    en qué país está: alias, orden, estado, categoría sugerida,
                            frecuencia sugerida, capacidades (p. ej. "moneo_auto")
capture_identities          cómo se reconoce en cada canal: dominio de correo,
                            paquete Android, palabras de OCR, jerga de voz/texto
```

- **Tipos**: banco, billetera, emisor de tarjeta, caja, luz, agua, gas, internet, celular, TV, streaming, software, seguros, educación, transporte, comercio, procesador de pagos.
- **Globales y locales**: Netflix es una ficha con varios países; Luz del Sur, solo PE.
- **Logos** en Supabase Storage (bucket público de solo lectura), con avatar de iniciales como respaldo.
- **Cuentas y deudas** ganan `institution_id` (opcional) y conservan el texto libre como respaldo.
- **Bandeja «Sugeridos»**: nombres escritos por usuarios que no están en el catálogo, agregados por país, visibles solo con 5 o más personas y sin montos ni identidad.
- **Permisos**: los usuarios leen lo activo de su país; solo administradores escriben.

### 3.4 Categorías

- Categorías con **clave estable** (`food`, `transport`, `utilities`…) y **etiqueta por idioma**; categorías propias de un país (gratificación, CTS, aguinaldo) se marcan con `country`.
- Las filas guardan la clave, no el texto en español. Migración: mapear las etiquetas actuales a claves.
- Una sola lista para gasto, ingreso y pago (hoy hay 4).
- Reglas palabra → categoría (`category_keywords`) por país, en la base de datos; reemplazan los 3 conjuntos de regex.

### 3.5 Idiomas (i18n)

- **next-intl** (encaja con App Router).
- Mensajes por idioma y módulo: `messages/es/{common,dashboard,movements,accounts,goals,juntas,hogar,auto,billing,onboarding,landing,settings,legal}.json`, y lo mismo en `en/`.
- **Localización cultural** con capas: `es` (neutro, base) → `es-PE` / `es-ES` / `es-US` (solo lo que cambia) → `en` → `en-AU` / `en-GB`. Se fusionan en ese orden.
- **Formato único** (`src/lib/i18n/format.ts`): `formatMoney(monto, moneda)` y `formatDate(fecha, estilo)` sobre `Intl.NumberFormat` / `Intl.DateTimeFormat` con el idioma y la zona horaria del usuario. Reemplaza los 2 formateadores, los ~45 «S/», los 29 `es-PE` y los 15 arreglos de meses.
- **Entrada de montos** según el idioma (coma o punto decimal).
- **Errores del servidor con código**: SQL lanza `MONEO:household.not_member`; el cliente lo traduce. Las notificaciones creadas en SQL guardan clave + parámetros.
- **Android**: textos a `strings.xml` con `values-en/`; formato de moneda con `NumberFormat` del idioma.

### 3.6 Captura agnóstica

```
Canal (manual | correo reenviado | Gmail | Outlook | notificación Android | SMS |
       OCR captura | OCR boleta | voz | texto | banca abierta [conector X])
   ↓
Sobre de captura  { canal, institución detectada, texto o datos, recibido_en, zona horaria }
   ↓
Lector (versión)  → Movimiento interpretado (monto, moneda ISO, fecha, comercio, tipo genérico)
   ↓
Sugerencia  (deduplicada por huella entre canales)  →  Movimiento confirmado
```

- `auto_suggestions` pasa de `source` a **`channel`** + **`parser`** + **`institution_id`**; `kind` pasa a tipos genéricos (`card_purchase`, `p2p_sent`, `p2p_received`, `bill_payment`, `transfer`…), y la marca la da la institución.
- `transactions` gana **`capture_channel`** (de dónde vino), para métricas por canal y país.
- Remitentes de confianza, paquetes Android y palabras de OCR salen del catálogo (`capture_identities`), no del código.
- **Banca abierta** = un conector más que produce los mismos sobres (Tink/GoCardless en Europa, Basiq en Australia, TrueLayer en Reino Unido, Plaid en EE. UU.). Sin proveedor fijo en la arquitectura.
- Los lectores peruanos actuales se mantienen; solo se registran como lectores de `PE`.

### 3.7 Cobros

- **`billing_prices`** (`plan_code`, `country`, `currency`, `price`, `tax_included`, `provider`, `active`): el plan define _qué es_; el precio, _cuánto cuesta en cada país_.
- **Proveedor abstracto**: `mercadopago_pe` hoy; luego Google Play / App Store (que cobran impuestos por ti en cada país) y, para la web fuera de Latinoamérica, un intermediario que actúe como vendedor responsable de impuestos (Paddle/Lemon Squeezy) o Stripe vía empresa en EE. UU.
- **Medios de pago por país** (Yape y PagoEfectivo solo en PE).
- La interfaz formatea con `plan.currency`; sin precios escritos a mano.
- Los derechos (`user_entitlements`) no cambian: PLUS es PLUS en cualquier país.

### 3.8 Legal

- Documentos por perfil legal (`pe`, `eu`, `us`, `au`, …), con versión y fecha.
- **Antes de cobrar fuera de Perú**: definir la empresa (hoy es persona natural con DNI) y revisarlo con un contador y un abogado por país.

### 3.9 Landings y validación de mercado

- Rutas de marketing: `moneo.plus/es`, `/us`, `/au`, `/ae`, `/sg` (la app sigue igual).
- Cada una: textos propios, moneda local en ejemplos, hreflang, OpenGraph por idioma, CTA a la **lista de espera**.
- **`waitlist`** (email, país, idioma, origen/UTM, respuestas de disposición a pagar) con alta pública controlada.
- `sitemap.ts` y `robots.ts`.
- Analítica con **país e idioma en todos los eventos**.
- **Tablero por país en el admin**: visitas, registros, lista de espera, costo por registro (con datos de anuncios cargados a mano al inicio), disposición a pagar.

---

## 4. Plan de implementación

Pasos pequeños, cada uno en su PR, **sin cambiar lo que ve un usuario peruano** salvo los arreglos del punto 2.

| #   | Paso                              | Qué incluye                                                                                                                                                                                                                                                    | Riesgo                                                           | Tiempo                |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| 1   | **Arreglos inmediatos**           | Calculadora de montos («1,250»), landing de precios, aviso de tasa faltante, bancos consistentes                                                                                                                                                               | Bajo                                                             | 1–2 días              |
| 2   | **Capa de formato única**         | `formatMoney` / `formatDate` con `Intl`; reemplazar «S/», `es-PE` y meses; AUD; entrada de montos por idioma                                                                                                                                                   | Medio (muchos archivos; se prueba que Perú se vea igual)         | 3–4 días              |
| 3   | **Contexto del usuario + países** | `country_code`, `locale`, `timezone` en `user_settings`; tabla `countries` (PE en vivo; ES, US, AU, AE, SG en lista de espera); detección (IP, zona horaria, idioma) y confirmación en Inicio; «País y región» en Configuración; usuarios por país en el admin | Bajo                                                             | 3 días                |
| 4   | **Landings + lista de espera**    | `/es`, `/us`, `/au`, `/ae`, `/sg`, `waitlist`, hreflang, sitemap, analítica con país                                                                                                                                                                           | Bajo (no toca la app)                                            | 3–4 días              |
| 5   | **Zona horaria por usuario**      | Redefinir las funciones SQL con la zona del usuario; avisos por zona; funciones de borde sin −5 h                                                                                                                                                              | **Medio-alto** (motor de saldos y fechas; pruebas SQL completas) | 3–4 días              |
| 6   | **Catálogo administrable**        | Tablas, logos en Storage, sección «Catálogo» en el admin, migrar Perú, la app lee del catálogo, `institution_id`                                                                                                                                               | Medio                                                            | 1–1,5 semanas         |
| 7   | **Sistema de idiomas**            | next-intl, estructura de mensajes, extraer landing + bienvenida + cobros primero; inglés de esas partes                                                                                                                                                        | Medio                                                            | 1–1,5 semanas (base)  |
| 8   | **Categorías con clave**          | Claves + etiquetas, migrar filas, reglas por país en la base de datos                                                                                                                                                                                          | Medio                                                            | 1 semana              |
| 9   | **Captura agnóstica**             | `channel`/`parser`/`institution_id`, `capture_channel` en movimientos, identidades desde el catálogo                                                                                                                                                           | Medio                                                            | 1 semana              |
| 10  | **Precios por país**              | `billing_prices`, proveedor abstracto, medios por país (sin proveedor nuevo aún)                                                                                                                                                                               | Medio                                                            | 1 semana              |
| —   | Después                           | Errores SQL con código, Android en varios idiomas, legal por país, extracción completa de textos, Paquete España                                                                                                                                               | —                                                                | según el país ganador |

**Orden recomendado**: 1 → 2 → 3 → 4 (la validación de mercado empieza ya) → 5 → 6 → 7 → 8 → 9 → 10.
Los pasos 1–4 suman unas **2 semanas** y dejan corriendo la validación internacional; los pasos 5–10, unas **5–6 semanas** más, en paralelo al crecimiento en Perú.

**Cada paso**: pruebas unitarias y SQL, prueba en navegador de que Perú se ve idéntico, staging primero y producción solo con aprobación.

---

## 5. Decisiones

| #   | Tema                   | Decisión (7 oct 2026)                                                                                 |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Orden del plan         | **Aprobado**, empezando por el paso 1                                                                 |
| 2   | Libro de Reclamaciones | **Más adelante**: el titular enviará los datos (razón social, RUC, dirección, correo)                 |
| 3   | Español base           | **Neutro**, con ajustes por país (es-PE, es-ES, es-US)                                                |
| 4   | Landings               | **Rutas**: `moneo.plus/es`, `/us`, `/au`, `/ae`, `/sg`                                                |
| 5   | Empresa                | Pendiente: persona natural mientras solo se cobre en Perú; revisar con contador antes de cobrar fuera |
