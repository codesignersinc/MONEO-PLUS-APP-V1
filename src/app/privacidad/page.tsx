import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Política de privacidad · MONEO+',
  description:
    'Qué datos trata MONEO+, para qué los usa, con quién los comparte y cómo ejercer tus derechos.',
};

const SECTIONS: LegalSection[] = [
  {
    title: '1. Quién es responsable de tus datos',
    paragraphs: [
      `MONEO+ (${LEGAL.site}) es un servicio de ${LEGAL.owner}, identificado con DNI N.º ${LEGAL.id}, con domicilio en ${LEGAL.address} ("MONEO+", "nosotros").`,
      `Para cualquier consulta sobre tus datos personales escríbenos a ${LEGAL.email}.`,
      'Tratamos tus datos personales conforme a la Ley N.º 29733, Ley de Protección de Datos Personales del Perú, y su reglamento.',
    ],
  },
  {
    title: '2. Qué datos tratamos',
    paragraphs: [
      'Datos de tu cuenta: tu nombre, tu correo electrónico, tu foto de perfil (si inicias sesión con Google) y la fecha en que te registraste. Si creas tu cuenta con correo y contraseña, la contraseña se guarda cifrada y nunca la vemos.',
      'Datos financieros que tú registras: cuentas y saldos, movimientos (gastos, ingresos y transferencias), conversiones de moneda, pagos, ingresos por cobrar, suscripciones, presupuestos, metas de ahorro, deudas, inversiones y tu configuración de monedas. MONEO+ no se conecta a tus bancos ni conoce tus claves bancarias.',
      'MONEO PLUS Duo y Familiar: quien paga el plan ve el nombre con el que te uniste y la fecha; tú ves su nombre y el plan. Nadie del pack ve las cuentas, saldos, movimientos ni ningún otro dato financiero de los demás.',
      'Juntas: el nombre, los aportes, los turnos y el estado de pagos de las Juntas que creas o en las que participas son visibles para los demás participantes de esa Junta.',
      'MONEO HOGAR: si creas un hogar o aceptas una invitación, las demás personas de ese hogar ven tu nombre en el hogar, los gastos que registras como gastos del hogar (descripción, categoría, monto, fecha y quién pagó), su reparto, los presupuestos, metas, aportes y compensaciones del hogar, y el ingreso que tú decidas declarar para el reparto proporcional. Nunca ven tus cuentas, saldos, movimientos personales ni tus ingresos registrados en MONEO.',
      'Preferencias: tus respuestas al configurar MONEO+ (tus objetivos, las categorías en las que más gastas, cómo prefieres registrar y tu primera meta) y qué avisos quieres recibir. No incluyen montos.',
      'MONEO AUTO (registro automático): solo si tú lo usas. (a) Si conectas tu Gmail, leemos únicamente los correos que envían tus bancos (BCP, BBVA, Interbank y Yape) para identificar cada movimiento; ver la sección 3. (b) Si reenvías los correos de tu banco a tu dirección privada de MONEO+, los leemos para identificar el movimiento y guardamos únicamente el monto, la moneda, el comercio o destinatario, la fecha y la hora, el banco, los últimos 4 dígitos de la tarjeta o cuenta y una huella cifrada del número de operación (para evitar duplicados). No guardamos el contenido del correo, ni números completos de tarjeta o cuenta, ni códigos de seguridad. También guardamos el código de confirmación que Gmail envía al activar el reenvío, para mostrártelo. (c) Las capturas de pantalla y fotos de comprobantes se leen en tu propio dispositivo: la imagen no se envía a nuestros servidores. (d) El dictado por voz usa el reconocimiento de voz de tu navegador: según el navegador, el audio puede ser procesado por su fabricante (por ejemplo, Google o Apple); MONEO+ no recibe ni guarda el audio, solo el texto que tú confirmas. (e) Del texto que pegas o escribes solo guardamos los datos del movimiento detectado.',
      'Pagos de MONEO PLUS: los procesa Mercado Pago. Nosotros recibimos y guardamos el plan elegido, el estado y las fechas de tu suscripción o compra y el número de operación de Mercado Pago. Nunca recibimos ni guardamos los datos de tu tarjeta.',
      'Lista de espera de otros países (por ejemplo moneo.plus/es o moneo.plus/us): si te unes, guardamos tu correo, el país y el idioma de la página, tu respuesta opcional sobre cuánto pagarías por MONEO PLUS y, si llegaste desde una campaña, su origen (parámetros UTM). No necesitas una cuenta. Solo usamos tu correo para avisarte cuando MONEO llegue a tu país.',
      'Datos técnicos: para mantener tu sesión iniciada y recordar preferencias de la app (por ejemplo, ocultar montos) usamos cookies y el almacenamiento local de tu navegador. También guardamos por 24 horas una cookie con el código de dos letras del país desde el que te conectas (nunca tu dirección IP), para sugerirte tu país y tu moneda. No usamos cookies de publicidad ni herramientas de seguimiento de terceros.',
    ],
  },
  {
    title: '3. Google: inicio de sesión y conexión con Gmail',
    paragraphs: [
      'Inicio de sesión: si eliges "Continuar con Google", Google nos comparte únicamente tu nombre, tu correo electrónico y tu foto de perfil (permisos "openid", "email" y "profile"). Ese permiso no da acceso a tu Gmail, tus contactos, tu calendario ni a ningún otro dato de tu cuenta de Google.',
      'Conexión con Gmail (opcional): solo si tú conectas tu Gmail en MONEO AUTO, nos das permiso de solo lectura ("gmail.readonly"). Con él buscamos exclusivamente los correos enviados por las direcciones oficiales de tus bancos (BCP, BBVA, Interbank y Yape) y, de cada uno, extraemos el monto, la moneda, el comercio o destinatario, la fecha y la hora, el banco y los últimos 4 dígitos de la tarjeta o cuenta, para sugerirte el movimiento. No abrimos ningún otro correo, no guardamos el contenido de los correos y no podemos enviar, borrar ni modificar nada. Guardamos cifrada la autorización que entrega Google, una versión abreviada de tu dirección de Gmail (para mostrarte qué cuenta conectaste) y una huella cifrada del identificador de cada correo ya leído, para no leerlo dos veces.',
      'Usamos esos datos solo para prestarte el servicio: crear tu cuenta, identificarte al iniciar sesión, mostrar tu nombre en la app y, si conectas Gmail, sugerirte tus movimientos. No los vendemos, no los usamos para publicidad, no los compartimos con terceros salvo con los proveedores que prestan el servicio (sección 5), ninguna persona los lee (salvo que tú nos lo pidas para darte soporte, o que la ley lo exija) y no los usamos para entrenar modelos de inteligencia artificial.',
      'El uso y la transferencia de la información recibida de las API de Google se ajustan a la Política de Datos de Usuario de los Servicios de API de Google (Google API Services User Data Policy), incluidos sus requisitos de Uso Limitado (Limited Use).',
      'Puedes desconectar Gmail en cualquier momento desde MONEO AUTO (borramos la autorización y le pedimos a Google que la revoque) o revocar el acceso de MONEO+ desde la configuración de seguridad de tu cuenta de Google (myaccount.google.com/permissions).',
    ],
  },
  {
    title: '4. Para qué usamos tus datos',
    paragraphs: [
      'Para prestarte el servicio: mostrarte tus finanzas, calcular saldos, reportes, presupuestos e insights; sugerirte movimientos con MONEO AUTO; gestionar tus Juntas y tu hogar en MONEO HOGAR; enviarte avisos dentro de la app; y gestionar tu plan MONEO PLUS.',
      'Para la seguridad del servicio: prevenir accesos indebidos y fraudes, y atender incidentes.',
      'Para cumplir obligaciones legales, por ejemplo las tributarias relacionadas con los pagos.',
      'No vendemos tus datos. No usamos tus datos financieros para publicidad ni los compartimos con redes publicitarias. Actualmente MONEO+ no muestra publicidad; si en el futuro el plan gratuito muestra anuncios, nunca se enviarán a las redes publicitarias tus saldos, movimientos, cuentas ni datos de MONEO AUTO, y actualizaremos esta política antes de hacerlo.',
    ],
  },
  {
    title: '5. Con quién se comparten (encargados del tratamiento)',
    paragraphs: [
      'Solo con proveedores que procesan los datos por cuenta nuestra y bajo nuestras instrucciones:',
      '• Supabase (base de datos, autenticación y funciones del servidor). Servidores en Estados Unidos.',
      '• Vercel (alojamiento de la aplicación web). Servidores en Estados Unidos y red de distribución global.',
      '• Postmark (recepción de los correos que reenvías a MONEO AUTO). Servidores en Estados Unidos. Postmark conserva temporalmente una copia de los correos recibidos en su registro de actividad, por un periodo limitado según su política de retención; MONEO+ no la usa para ningún otro fin.',
      '• Mercado Pago (procesamiento de pagos de MONEO PLUS). Le compartimos el plan, el monto y el correo con el que pagas.',
      '• Google (inicio de sesión con Google y lectura de los correos de tu banco en Gmail, si lo eliges).',
      'Por esto, tus datos se transfieren y almacenan fuera del Perú (flujo transfronterizo), con proveedores que aplican medidas de seguridad adecuadas. Solo compartiremos datos con autoridades cuando una norma o una orden judicial lo exija.',
    ],
  },
  {
    title: '6. Cuánto tiempo los conservamos',
    paragraphs: [
      'Mientras mantengas tu cuenta. Cuando eliminas tu cuenta, borramos de inmediato tu cuenta y todos tus datos. Las copias de seguridad de nuestros proveedores se eliminan automáticamente en sus ciclos de rotación.',
      'Lista de espera: hasta que MONEO llegue a tu país y te avisemos, o hasta que nos pidas que te borremos, lo que ocurra primero.',
      'Los registros de pagos (plan, monto, fecha y número de operación) se conservan el tiempo que exijan las normas tributarias y contables.',
    ],
  },
  {
    title: '7. Tus derechos',
    paragraphs: [
      `Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición (derechos ARCO), así como revocar tu consentimiento, escribiendo a ${LEGAL.email}. Te responderemos dentro de los plazos que establece la ley.`,
      'Puedes corregir tus datos y eliminar tu cuenta con todos tus datos en cualquier momento desde Configuración → Eliminar cuenta. Si organizas una Junta activa, primero debes cerrarla o transferirla.',
      'Puedes desactivar MONEO AUTO cuando quieras: desconecta tu Gmail, deja de reenviar correos o genera una dirección nueva desde MONEO AUTO.',
      'Si consideras que no atendimos tu solicitud, puedes acudir a la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos.',
    ],
  },
  {
    title: '8. Seguridad',
    paragraphs: [
      'Tus datos viajan cifrados (HTTPS) y se guardan cifrados por nuestros proveedores. Cada usuario solo puede acceder a su propia información: lo controla la base de datos, no solo la app. Las contraseñas se guardan cifradas.',
      'Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te lo comunicaremos y tomaremos las medidas necesarias.',
    ],
  },
  {
    title: '9. Menores de edad',
    paragraphs: [
      'MONEO+ está dirigido a personas mayores de 18 años. No recopilamos a sabiendas datos de menores de edad; si detectamos una cuenta de un menor, la eliminaremos.',
    ],
  },
  {
    title: '10. Cambios en esta política',
    paragraphs: [
      'Si cambiamos esta política te lo avisaremos en la app antes de que el cambio entre en vigor. La fecha de la última actualización aparece al inicio.',
    ],
  },
];

export default function PrivacidadPage() {
  return <LegalPage title="Política de privacidad" updated={LEGAL.updated} sections={SECTIONS} />;
}
