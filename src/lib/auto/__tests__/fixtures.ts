// Real bank messages provided by the owner, ANONYMIZED: names, phone numbers, card and
// account digits, operation/receipt numbers and security codes are fictitious.

export const INTERBANK_EMAIL_RECURRENTE = {
  sender: 'Servicio al cliente <servicioalcliente@netinterbank.com.pe>',
  subject: 'Carlos, se ha realizado un pago recurrente a tu Tarjeta Interbank Visa Débito Clásica',
  text: `Carlos, se ha realizado un pago recurrente a tu Tarjeta Interbank Visa Débito Clásica
Conoce el detalle:
Tarjeta: ****4821
Comercio: EBN*SG PDFGURU
Monto: S/. 103.71
Fecha: 05/10/2026
Hora: 02:48 PM
¿Vas a comprar por internet?`,
};

export const INTERBANK_EMAIL_CONSUMO = {
  sender: 'servicioalcliente@netinterbank.com.pe',
  subject: 'Carlos, realizaste un consumo con tu Tarjeta Interbank Visa Débito Clásica',
  text: `Carlos, realizaste un consumo con tu Tarjeta Interbank Visa Débito Clásica
Conoce el detalle:
Tarjeta: ****4821
Comercio: E S EL DERBY 1
Monto: S/. 40.00
Fecha: 04/10/2026
Hora: 05:41 AM`,
};

const footer = `¿Problemas con tus compras?
Si tu compra fue rechazada, cancelada o duplicada, el tiempo estimado de devolución será de 3 a 7 días.
¿No reconoces esta operación?
Comunícate inmediatamente con nosotros al (01) 311-9898 anexo *911 para ayudarte a verificarla.
El BCP nunca te solicitará datos confidenciales por correo, tales como tu clave secreta de cajero de 4 dígitos, clave de internet de 6 dígitos, número de tu tarjeta de débito o crédito, fecha de vencimiento, código CVV.
Banco de Crédito del Perú S.A. - RUC: 20100047218.`;

export const BCP_EMAIL_CONSUMO_1 = {
  sender: 'BCP Notificaciones <notificaciones@notificacionesbcp.com.pe>',
  subject: 'Realizaste un consumo con tu Tarjeta de Crédito BCP - Servicio de Notificaciones BCP',
  text: `Hola Carlos Andrés,

Realizaste un consumo de S/ 2.99 con tu Tarjeta de Crédito BCP en BENAVIDES C18 MIRAFLORE.

Por tu seguridad, te enviamos los datos de tu operación.

Monto

Total del consumo\tS/ 2.99

Datos de la operación

Operación realizada\tConsumo Tarjeta de Crédito
Fecha y hora\t01 de octubre de 2026 - 05:56 PM
Número de Tarjeta de Crédito\t************7391
Empresa\tBENAVIDES C18 MIRAFLORE
Número de operación\t0000111222

${footer}`,
};

export const BCP_EMAIL_CONSUMO_2 = {
  sender: 'notificaciones@notificacionesbcp.com.pe',
  subject: 'Realizaste un consumo con tu Tarjeta de Crédito BCP - Servicio de Notificaciones BCP',
  text: `Hola Carlos Andrés,
Realizaste un consumo de S/ 92.92 con tu Tarjeta de Crédito BCP en E WONG BENAVIDES.
Por tu seguridad, te enviamos los datos de tu operación.
Monto
Total del consumo\tS/ 92.92
Datos de la operación
Operación realizada\tConsumo Tarjeta de Crédito
Fecha y hora\t01 de octubre de 2026 - 07:45 PM
Número de Tarjeta de Crédito\t************7391
Empresa\tE WONG BENAVIDES
Número de operación\t0000333444
${footer}`,
};

export const BBVA_EMAIL_TRANSFER_PROPIA = {
  sender: 'BBVA <procesos@bbva.com.pe>',
  subject: 'BBVA - Constancia Transf. Interbancaria',
  text: `Hola, Carlos
Has realizado con éxito la operación:

Transferencia interbancaria

Importe transferido

S/ 50.00

Comisión\tS/ 0.00
ITF\tS/ 0.00
Importe cargado\tS/ 50.00
Importe abonado\tS/ 50.00


DETALLES DE LA OPERACIÓN
Titular de la cuenta

Carlos Andrés Pérez Rojas

Tipo de operación

Transferencia interbancaria

Número de operación

00000099000000001

Fecha y hora de la operación

04 octubre, 2026 05:41

Cuenta de origen

Ahorros

Cuenta de destino

• 6157

Banco de destino

INTERBANK

Nombre del beneficiario

Carlos Andrés Pérez Rojas


Esta cuenta es propia, la operación será exonerada del ITF.

Recuerda que, por ningún medio de comunicación ni por ningún motivo, te pediremos tus datos confidenciales.`,
};

export const YAPE_EMAIL_SERVICIO = {
  sender: 'YAPE <noreply@yape.pe>',
  subject: 'Tu yapeo de servicio ha sido confirmado',
  text: `Hola CARLOS,
¡Tu servicio fue yapeado con éxito!
Monto total
S/ 52.90

Yapero(a):\tCARLOS ANDRES PEREZ ROJAS
Número de celular:\t*** *** 909
Fecha y hora:\t27 Jun. 2025 - 06:56 pm
Nº de operación Yape:\t01234567
Detalle del servicio:
Empresa:\tBitel
Servicio:\tPostpago Bitel Soles
Código de usuario:\t900000001
Titular del servicio:\tCarlos Andrés
Número de recibo:\t000000000000009999888820250401
Vencimiento de documento:\t25/06/2025

Resuelve tus dudas en:
yape.com.pe
Recuerda que no debes compartir tu clave secreta con nadie.`,
};

export const YAPE_EMAIL_ENVIADO = {
  sender: 'YAPE Notificaciones <notificaciones@yape.pe>',
  subject: 'Por tu seguridad, te notificaremos por cada yapeo que realices',
  text: `¡Hola, CARLOS ANDRES PEREZ R.!
¡Acabas de yapear exitosamente!
Monto de yapeo*
S/
20.00
Yapero\tCARLOS ANDRES PEREZ R.
Tu número de celular\tXXXXXXXXX555
Fecha y Hora de la operación\t24 agosto 2026 - 10:01 p. m.
Celular del Beneficiario\tXXXXXXXXX777
Nombre del Beneficiario\tROSA LIMA C.
N° de operación\t7654321`,
};

// Lock-screen notifications (app name as sender).
export const YAPE_PUSH_RECIBIDO_1 = {
  sender: 'Yape',
  text: 'Confirmación de Pago\nRosa Lim* te envió un pago por S/ 13.3. El cód. de seguridad es: 731',
};
export const YAPE_PUSH_RECIBIDO_2 = {
  sender: 'Yape',
  text: 'Confirmación de Pago\nAna Torr* te envió un pago por S/ 20. El cód. de seguridad es: 289',
};

export const IB_PUSH_PLIN = { sender: 'Interbank', text: 'Luis Vega te ha plineado S/ 100.00' };
export const IB_PUSH_PLIN_2 = {
  sender: 'Interbank',
  text: 'María Elena Soto Díaz te ha plineado S/ 87.00',
};
export const IB_PUSH_RECURRENTE = {
  sender: 'Interbank',
  text: 'Se realizó un pago recurrente de S/.19.90 en OPENAI *CHATGPT SUBSCR con tu Tarjeta de Débito.',
};
export const IB_PUSH_RECURRENTE_2 = {
  sender: 'Interbank',
  text: 'Se realizó un pago recurrente de S/.103.71 en EBN*SG PDFGURU con tu Tarjeta de Débito.',
};
export const IB_PUSH_CONSUMO_YOPO = {
  sender: 'Interbank',
  text: 'Realizaste un consumo de S/.21.00 en IZI*YOPO BENVID*0056604 con tu Tarjeta de Débito.',
};
export const IB_PUSH_PAGO_YOPO = {
  sender: 'Interbank',
  text: 'PAGO S/ 21.00\nA: IZI*YOPOBENVIDES MIRAFLORES\n(04/10 05:20:55)',
};
export const IB_PUSH_CONSUMO_OCORIS = {
  sender: 'Interbank',
  text: 'Realizaste un consumo de S/.28.58 en OCORIS 2 con tu Tarjeta de Débito.',
};
export const IB_PUSH_PAGO_OCORIS = {
  sender: 'Interbank',
  text: 'PAGO S/ 28.58\nA: OCORIS2 LA VICTORIA\n(04/10 06:15:17)',
};
