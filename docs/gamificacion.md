# Gamificación de MONEO+

Principio: **las finanzas dan poder, el juego da diversión y los aliados dan premios reales.**

| Moneda      | Cómo se gana                       | Para qué sirve                                          |
| ----------- | ---------------------------------- | ------------------------------------------------------- |
| **Coronas** | Solo con hábitos con tu dinero     | Canjes con negocios aliados (fase 3)                    |
| **Bananas** | Jugando MONEO Run (fase 2, aún no) | Ropa del personaje, power-ups y vidas, solo en el juego |

## Fases

1. **Coronas y logros** (esta): Coronas por hábitos, racha, logros y nivel. Sin juego.
2. **MONEO Run**: el juego dentro de la app (1 mundo, 3 vidas al día, power-ups según tus
   hábitos).
3. **Aliados piloto**: Tienda de Coronas con 3 a 10 aliados y códigos QR de un solo uso
   (48 h).
4. **Temporadas**: ligas por constancia, jefe de fin de mes y retos con amigos o la junta.

## Fase 1: reglas

Las otorga solo la base de datos, en `coronas_sync()` (migración `20261023120000`). La app la
llama al abrir, después de cada cambio, al navegar y al volver a primer plano. Cada premio tiene
una `award_key` única, así que repetir la llamada no duplica nada.

| Regla             | Coronas | Condición                                                                      | Tope           |
| ----------------- | ------- | ------------------------------------------------------------------------------ | -------------- |
| `registro_dia`    | +1      | Hay un movimiento creado hoy                                                   | 1 por día      |
| `racha_7`         | +5      | La racha llega a 7, 14, 21… días                                               | —              |
| `pago_a_tiempo`   | +2      | Pago pagado con vencimiento hoy o después, creado antes de hoy                 | 2 por día      |
| `aporte_meta`     | +2      | Una meta supera su monto más alto visto                                        | 1 por semana   |
| `presupuesto_mes` | +10     | Mes anterior sin pasarse en ninguna categoría y con 10 o más días registrados  | 1 por mes      |
| `junta_completa`  | +10     | Junta finalizada con 3 o más participantes con cuenta (aparte del organizador) | 1 cada 30 días |
| `auto_confirmada` | +1      | Sugerencia de MONEO AUTO (no la escrita a mano) registrada hoy                 | 2 por día      |
| `logro`           | bono    | Primer logro de cada tipo (`coronas_achievements`)                             | 1 por logro    |

**Contra trampas.** El cliente puede escribir `transactions.created_at`, `juntas.created_at` y
`auto_suggestions`, así que no se premia nada hacia atrás: cada regla mira lo que el servidor ve
«hoy» (zona horaria de `user_settings`, o `America/Lima`). La racha sale de las filas
`registro_dia` del ledger, no de los movimientos. Las metas usan una marca de agua
(`coronas_goal_marks`): bajar y volver a subir no vuelve a premiar.

**Vencimiento.** Cada fila vence a los 12 meses (`expires_at`). El saldo cuenta solo lo vigente;
el nivel usa el total histórico y nunca baja.

**Niveles** (`src/lib/coronas.ts`): Semilla 0 · Brote 20 · Ahorrador 60 · Estratega 150 ·
Maestro 300 · Leyenda 600.

**Privacidad.** El ledger guarda la regla, la clave, la fecha y la cantidad: ni montos, ni
comercios, ni cuentas. Cada persona ve solo lo suyo (RLS) y nadie puede escribir en esas tablas.

## Pendiente para las fases siguientes

- Referidos verificados (aún no hay sistema de referidos).
- Canjes: filas negativas en el ledger que consumen primero las Coronas más cercanas a vencer.
- Bananas y MONEO Run.
