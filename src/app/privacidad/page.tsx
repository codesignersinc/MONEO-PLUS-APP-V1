import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Política de privacidad · MONEO+' };

// BORRADOR pendiente de revisión legal. Los textos entre corchetes son datos que
// debe completar el titular del servicio.
const SECTIONS: LegalSection[] = [
  {
    title: '1. Quién es responsable de tus datos',
    paragraphs: [
      'MONEO+ es operado por [razón social], con RUC [número] y domicilio en [dirección], Perú ("MONEO+", "nosotros"). Para cualquier consulta sobre tus datos escríbenos a [correo de contacto].',
      'Tratamos tus datos personales conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento.',
    ],
  },
  {
    title: '2. Qué datos tratamos',
    paragraphs: [
      'Datos de tu cuenta: correo electrónico, nombre y la fecha de registro.',
      'Datos financieros que tú registras manualmente: cuentas y saldos, movimientos, transferencias, conversiones de moneda, pagos, ingresos por cobrar, suscripciones, presupuestos, metas de ahorro, deudas, inversiones y tu configuración de monedas.',
      'Juntas: los datos de las Juntas que creas o en las que participas (nombre, aportes, turnos y estado de pagos) son visibles para los demás participantes de esa Junta.',
      'No accedemos a tus cuentas bancarias ni a tus correos, y no recopilamos datos de tarjetas.',
    ],
  },
  {
    title: '3. Para qué los usamos',
    paragraphs: [
      'Únicamente para prestarte el servicio: mostrarte tus finanzas, calcular saldos y reportes, enviarte notificaciones dentro de la app y gestionar tus Juntas.',
      'No vendemos tus datos ni los usamos para publicidad.',
    ],
  },
  {
    title: '4. Con quién se comparten',
    paragraphs: [
      'Usamos proveedores que procesan los datos por cuenta nuestra: Supabase (base de datos y autenticación) y Vercel (alojamiento de la aplicación). Sus servidores pueden estar fuera del Perú: [indicar región o países].',
      'Solo compartiremos datos con autoridades cuando una norma o una orden judicial lo exija.',
    ],
  },
  {
    title: '5. Cuánto tiempo los conservamos',
    paragraphs: [
      'Mientras mantengas tu cuenta. Cuando la eliminas, borramos tu cuenta y tus datos de forma inmediata; las copias de seguridad de nuestros proveedores se eliminan en un plazo de [plazo].',
    ],
  },
  {
    title: '6. Tus derechos',
    paragraphs: [
      'Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a [correo de contacto].',
      'Puedes eliminar tu cuenta y todos tus datos en cualquier momento desde Configuración → Eliminar cuenta. Si organizas una Junta activa, primero debes cerrarla o transferirla.',
      'Si consideras que no atendimos tu solicitud, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.',
    ],
  },
  {
    title: '7. Seguridad',
    paragraphs: [
      'Tus datos viajan cifrados y cada usuario solo puede acceder a su propia información. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te lo comunicaremos.',
    ],
  },
  {
    title: '8. Cambios',
    paragraphs: [
      'Si cambiamos esta política te lo avisaremos en la app antes de que el cambio entre en vigor.',
    ],
  },
];

export default function PrivacidadPage() {
  return <LegalPage title="Política de privacidad" updated="[fecha]" sections={SECTIONS} />;
}
