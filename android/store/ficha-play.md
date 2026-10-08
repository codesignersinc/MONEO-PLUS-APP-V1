# MONEO+ en Google Play — textos y respuestas para Play Console

Todo lo de este archivo se copia y pega en Play Console. Si cambia el tratamiento de datos,
actualízalo junto con `/privacidad` (src/app/privacidad/page.tsx).

---

## 1. Ficha de Play Store (Hacer crecer → Presencia en Play Store → Ficha principal)

**Nombre de la app** (máx. 30): `MONEO+ Finanzas y Negocio`

**Descripción breve** (máx. 80):

```
Ordena tu dinero: gastos, pagos, metas, juntas y tu negocio. Simple y en soles.
```

**Descripción completa** (máx. 4000):

```
MONEO+ es la app para ordenar tu dinero sin hojas de cálculo. Registra en segundos lo que gastas y lo que ganas, y mira cuánto puedes gastar hoy sin pasarte.

TODO TU DINERO EN UN SOLO LUGAR
• Cuentas, efectivo, tarjetas y billeteras (Yape, Plin) con su saldo al día.
• Gastos, ingresos y transferencias entre tus cuentas.
• Soles, dólares y otras monedas, con el tipo de cambio que tú decides.
• Patrimonio: lo que tienes menos lo que debes.

PAGOS, COBROS Y METAS
• Recordatorios de pagos y suscripciones antes de que venzan.
• Ingresos por cobrar y deudas con su avance.
• Metas de ahorro y presupuestos por categoría.
• «Puedes gastar hoy»: un estimado diario según tus pagos y tus metas.

MONEO AUTO (MONEO PLUS)
• Reenvía los correos de tu banco o conecta tu Gmail y MONEO te sugiere el movimiento: tú decides si lo registras.
• Escríbelo como lo dirías: «almuerzo 18 con Yape».
• Lee la foto de tu comprobante en tu propio celular.

MONEO NEGOCIO (MONEO PLUS)
• Separa las finanzas de tu negocio de las personales con un solo botón.
• Caja, lo que te deben y lo que debes, clientes, proveedores y equipo.
• Reportes del mes y exportación en CSV y PDF.

JUNTAS Y HOGAR
• Organiza juntas (panderos) con turnos, aportes y sorteo.
• MONEO HOGAR: gastos compartidos con tu pareja o familia sin mostrar tus cuentas personales.

WIDGET
• Mira en tu pantalla de inicio cuánto puedes gastar hoy, tu disponible y tu próximo pago. Los montos aparecen ocultos hasta que tocas el ojito.

PRIVACIDAD
• MONEO+ no se conecta a tu banco ni conoce tus claves.
• No vendemos tus datos ni los usamos para publicidad.
• Puedes eliminar tu cuenta y todos tus datos desde Configuración.

MONEO+ no es una entidad financiera: no guarda ni mueve dinero. Tus saldos se calculan con lo que registras.

Planes: MONEO FREE gratis y MONEO PLUS con funciones avanzadas.
```

**Gráficos**

- Ícono de la app: `android/store/play-icon-512.png` (512×512).
- Gráfico de funciones: `android/store/feature-graphic-1024x500.png` (1024×500).
- Capturas de teléfono: `android/store/screenshots/*.png` (1080×1920; sube de 4 a 8).

**Categoría**: Finanzas. **Correo de contacto**: hola@moneo.plus. **Sitio web**: https://moneo.plus.
**Política de privacidad**: https://moneo.plus/privacidad

---

## 2. Contenido de la app (Supervisa y mejora → Política → Contenido de la app)

### Política de privacidad

`https://moneo.plus/privacidad`

### Acceso a la app

«Todas las funciones o algunas están restringidas» → agrega instrucciones:

- Crea una cuenta de prueba **con un correo real tuyo** (el registro rechaza correos inventados)
  y dale MONEO PLUS desde el panel o la base de datos, para que el revisor vea AUTO y NEGOCIO.
- Texto: `Inicia sesión con el correo y la contraseña de abajo. La cuenta tiene MONEO PLUS activo.`

### Anuncios

**No**, la app no contiene anuncios.

### Clasificación del contenido

Cuestionario IARC → categoría **«Todas las demás categorías de apps»** (utilidad/productividad).
Responde **No** a violencia, sexo, lenguaje, drogas, apuestas y contenido generado por
usuarios compartido públicamente. Interacción entre usuarios: **Sí, limitada** (Juntas y
MONEO HOGAR solo entre personas invitadas; no hay chat ni contenido público).

### Público objetivo

**18 años o más** (los términos exigen mayoría de edad). No atrae a niños.

### App de noticias / Salud / Gobierno

No.

### Funciones financieras

Marca solo lo que hace la app: **gestión de finanzas personales (presupuestos y registro de
gastos)**. MONEO+ **no** ofrece préstamos, no es banco ni billetera, no hace pagos ni
transferencias de dinero, no compra ni vende criptomonedas ni acciones. Los pagos de MONEO
PLUS se cobran fuera de la app de Android (la app oculta el cobro: `?source=android`).

### Seguridad de los datos

**Recopilación y uso compartido**

- ¿Tu app recopila o comparte alguno de los tipos de datos del usuario requeridos? **Sí**
- ¿Todos los datos se encriptan en tránsito? **Sí** (HTTPS)
- ¿Ofreces una forma de que los usuarios soliciten la eliminación de sus datos? **Sí**
  - URL: `https://moneo.plus/privacidad` (sección 7) — y dentro de la app: Configuración →
    Eliminar cuenta.

**Tipos de datos** (para cada uno: Recopilado **Sí** · Compartido **No** · Procesado de forma
efímera **No** salvo donde se indica · Obligatorio u opcional · Finalidad)

| Sección                             | Tipo                                                                                                                             | ¿Obligatorio?  | Finalidad                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| Información personal                | **Nombre**                                                                                                                       | Obligatorio    | Funcionalidad de la app, Gestión de la cuenta                        |
| Información personal                | **Dirección de correo electrónico**                                                                                              | Obligatorio    | Funcionalidad de la app, Gestión de la cuenta                        |
| Información financiera              | **Otra información financiera** (cuentas, saldos, movimientos, pagos, metas, deudas y datos del negocio que la persona registra) | Obligatorio    | Funcionalidad de la app                                              |
| Información financiera              | **Historial de compras** (plan de MONEO PLUS comprado)                                                                           | Opcional       | Funcionalidad de la app, Gestión de la cuenta                        |
| Mensajes                            | **Correos electrónicos** (solo los avisos del banco, si conecta Gmail o reenvía correos; se guarda solo el movimiento detectado) | Opcional       | Funcionalidad de la app — marca **«Procesado de forma efímera: Sí»** |
| Ubicación                           | **Ubicación aproximada** (país de la conexión, solo para sugerir país y moneda)                                                  | Obligatorio    | Funcionalidad de la app — **efímera: Sí**                            |
| Información y rendimiento de la app | —                                                                                                                                | No se recopila | —                                                                    |
| Identificadores del dispositivo     | —                                                                                                                                | No se recopila | —                                                                    |

No marques: fotos (los comprobantes se leen en el teléfono), audio (el dictado lo procesa el
teclado/navegador y MONEO solo recibe el texto confirmado), contactos, calendario, ubicación
precisa, salud ni historial web.

**¿Compartido con terceros?** **No.** Supabase, Vercel, Postmark y Mercado Pago son proveedores
que procesan datos por cuenta de MONEO+ (encargados del tratamiento), y Google Play no los
considera «compartir».

### Permisos

La app de Android usa **Internet** y **Notificaciones** (`POST_NOTIFICATIONS`, Android 13+:
avisos de la web como pagos por vencer; Android pregunta antes). No pide ubicación, cámara,
micrófono ni contactos (la cámara y el micrófono los pide Chrome cuando usas SCAN o VOZ).

---

## 3. Prueba cerrada (requisito para cuentas personales nuevas)

- Prueba y lanza → Pruebas → **Prueba cerrada** → crea el segmento «Testers» con una lista de
  **al menos 12 correos de Gmail**.
- Sube la misma versión (o una nueva) y publícala en ese segmento.
- Los 12 deben **aceptar la invitación, instalar y mantener la app 14 días seguidos**.
- Después: Panel → «Solicitar acceso a producción» (Google pregunta cómo probaron la app).
