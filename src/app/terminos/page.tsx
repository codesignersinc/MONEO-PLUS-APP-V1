import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Términos y condiciones · MONEO+',
  description: 'Condiciones de uso de MONEO+, de MONEO NEGOCIO y de los planes MONEO PLUS.',
};

const SECTIONS: LegalSection[] = [
  {
    title: '1. El servicio',
    paragraphs: [
      `MONEO+ (${LEGAL.site}) es un servicio de ${LEGAL.owner}, identificado con DNI N.º ${LEGAL.id}, con domicilio en ${LEGAL.address} ("MONEO+", "nosotros"). Es una aplicación para organizar tus finanzas personales: registrar cuentas, movimientos, pagos, ingresos, presupuestos y metas, detectar movimientos con MONEO AUTO, coordinar Juntas con otras personas y, con MONEO NEGOCIO, llevar las finanzas de tu negocio separadas de las personales.`,
      'Al crear una cuenta aceptas estos términos y la Política de privacidad.',
    ],
  },
  {
    title: '2. Tu cuenta',
    paragraphs: [
      'Debes ser mayor de 18 años y dar datos verdaderos. Eres responsable de mantener segura tu contraseña o tu cuenta de Google, y de la actividad de tu cuenta.',
      'Puedes eliminar tu cuenta cuando quieras desde Configuración. Si organizas una Junta activa, primero debes cerrarla o transferirla.',
    ],
  },
  {
    title: '3. La información que registras',
    paragraphs: [
      'Los saldos, reportes e insights se calculan con los datos que tú ingresas o confirmas y con los tipos de cambio que configuras. MONEO+ no se conecta a tu banco, por lo que pueden no coincidir con tus saldos reales.',
      'MONEO AUTO sugiere movimientos a partir de los avisos de tu banco, capturas o texto; revisa cada sugerencia antes de registrarla, porque puede contener errores de lectura.',
      'MONEO+ no es una entidad financiera, no guarda ni mueve dinero y no ofrece asesoría financiera, tributaria ni de inversión. Los consejos e insights de la app son informativos.',
    ],
  },
  {
    title: '4. Planes: MONEO FREE y MONEO PLUS',
    paragraphs: [
      'MONEO FREE es gratuito e incluye las funciones esenciales. MONEO PLUS incluye funciones adicionales (como MONEO AUTO, MONEO VOZ, MONEO SCAN, MONEO NEGOCIO y reportes avanzados) y no muestra anuncios.',
      'Los precios se muestran en soles (S/) e incluyen IGV. Planes disponibles: MONEO PLUS mensual y anual, pases prepagados de 3 meses y 1 año, MONEO PLUS de por vida (y, durante un tiempo limitado, el precio Fundador), y los planes Duo (2 personas) y Familiar (hasta 6 personas), mensuales o prepagados. Los precios vigentes son los que se muestran al momento de la compra.',
      'Prueba gratis: los planes mensual y anual pueden incluir 7 días de prueba gratis, una sola vez por persona. Durante la prueba no se cobra nada; al terminar se cobra automáticamente el precio del plan elegido, salvo que canceles antes. Antes de confirmar verás el precio, la fecha del primer cobro y la frecuencia.',
      'Renovación: los planes mensual y anual se renuevan automáticamente cada mes o cada año, con cargo al medio de pago que registraste en Mercado Pago, hasta que los canceles. Si cambiamos el precio de un plan, te avisaremos con anticipación y el nuevo precio se aplicará desde la siguiente renovación.',
      'Cancelación: puedes cancelar cuando quieras. Conservarás MONEO PLUS hasta el final del periodo ya pagado (o de la prueba gratis) y no se harán más cobros. Salvo que la ley disponga otra cosa, no hacemos reembolsos proporcionales por el tiempo no usado.',
      'MONEO NEGOCIO se activa solo con un plan pagado de MONEO PLUS (mensual, anual, pase, de por vida, o un lugar en un plan Duo o Familiar). La prueba gratis sin tarjeta no lo incluye. Si tu plan termina, los datos de tu negocio se conservan y vuelves a verlos al activar un plan pagado.',
      'Duo y Familiar: quien paga el plan invita a las demás personas con un enlace de un solo uso. Cada persona usa su propia cuenta y recibe MONEO PLUS mientras el plan de quien paga esté vigente y tenga un lugar para ella; quien paga puede quitar a alguien y cada persona puede salir cuando quiera, sin perder sus datos. Algunas funciones (como la conexión con Gmail) pueden requerir un plan pagado a nombre propio.',
      'Planes de por vida (incluido Fundador): un solo pago, sin renovaciones, que da acceso a MONEO PLUS mientras MONEO+ siga ofreciendo el servicio. El precio Fundador es una oferta de lanzamiento y puede dejar de ofrecerse en cualquier momento.',
      'Pagos: los procesa Mercado Pago, según sus propios términos. MONEO+ no recibe ni guarda los datos de tu tarjeta. Si un pago es rechazado o falla una renovación, MONEO PLUS se mantiene hasta el final del periodo pagado y luego tu cuenta pasa a MONEO FREE, sin perder tus datos. Si se cobra dos veces el mismo plan de por vida, el pago repetido se devuelve automáticamente.',
    ],
  },
  {
    title: '5. Juntas',
    paragraphs: [
      'Las Juntas son acuerdos entre sus participantes. MONEO+ solo ofrece herramientas para organizarlas: no recibe ni custodia aportes, no garantiza los pagos de los participantes y no es parte de esos acuerdos.',
    ],
  },
  {
    title: '6. MONEO NEGOCIO',
    paragraphs: [
      'MONEO NEGOCIO es una herramienta de gestión para pequeños negocios y trabajadores independientes: separa las cuentas y movimientos del negocio de tus finanzas personales y te muestra caja, cobros, pagos, contactos, equipo y reportes.',
      'No es un servicio contable, tributario ni laboral. MONEO+ no lleva tu contabilidad, no emite comprobantes de pago electrónicos, no presenta declaraciones ante la SUNAT ni ante otra autoridad, y no calcula impuestos, planillas, beneficios sociales ni aportes. Los reportes y su exportación en CSV o PDF son reportes de gestión hechos con los datos que registras: no son estados financieros ni reemplazan a un contador. Cumplir tus obligaciones contables, tributarias y laborales es tu responsabilidad.',
      'Datos de terceros: al registrar clientes, proveedores o personas de tu equipo (nombre, teléfono, correo, notas, sueldo o montos) declaras que tienes una relación con ellas que te permite tratar esos datos, que registras solo lo necesario para tu negocio y que no registras datos sensibles (por ejemplo de salud, religión u opiniones políticas). MONEO+ no escribe ni llama a tus contactos: los botones de llamada, WhatsApp o correo abren tu propia aplicación.',
      'El efectivo que pasa entre tu negocio y tus finanzas personales se registra como retiro o aporte; MONEO+ no mueve dinero entre tus cuentas reales.',
    ],
  },
  {
    title: '7. Uso aceptable',
    paragraphs: [
      'No debes usar MONEO+ para actividades ilícitas, para acceder a datos de otras personas, para reenviar a MONEO AUTO correos que no sean tuyos ni para afectar el funcionamiento del servicio. Podemos suspender cuentas que incumplan estos términos.',
    ],
  },
  {
    title: '8. Disponibilidad y responsabilidad',
    paragraphs: [
      'Trabajamos para que el servicio esté disponible y funcione correctamente, pero puede tener interrupciones o errores. En la medida permitida por la ley, MONEO+ no responde por decisiones tomadas con base en la información de la app.',
      'Nada de lo indicado en estos términos limita los derechos que te reconoce el Código de Protección y Defensa del Consumidor (Ley N.º 29571).',
    ],
  },
  {
    title: '9. Cambios, contacto y ley aplicable',
    paragraphs: [
      'Podemos actualizar estos términos; te avisaremos en la app antes de que los cambios entren en vigor.',
      `Para consultas, reclamos o solicitudes escríbenos a ${LEGAL.email}.`,
      'Estos términos se rigen por las leyes del Perú.',
    ],
  },
];

export default function TerminosPage() {
  return <LegalPage title="Términos y condiciones" updated={LEGAL.updated} sections={SECTIONS} />;
}
