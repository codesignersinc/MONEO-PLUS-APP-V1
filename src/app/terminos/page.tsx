import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Términos y condiciones · MONEO+' };

// BORRADOR pendiente de revisión legal. Los textos entre corchetes son datos que
// debe completar el titular del servicio.
const SECTIONS: LegalSection[] = [
  {
    title: '1. El servicio',
    paragraphs: [
      'MONEO+, operado por [razón social] ("MONEO+"), es una aplicación para organizar tus finanzas personales: registrar cuentas, movimientos, pagos, ingresos, presupuestos y metas, y coordinar Juntas con otras personas.',
      'Al crear una cuenta aceptas estos términos y la Política de privacidad.',
    ],
  },
  {
    title: '2. Tu cuenta',
    paragraphs: [
      'Debes ser mayor de edad y dar datos verdaderos. Eres responsable de mantener segura tu contraseña y de la actividad de tu cuenta.',
      'Puedes eliminar tu cuenta cuando quieras desde Configuración. Si organizas una Junta activa, primero debes cerrarla o transferirla.',
    ],
  },
  {
    title: '3. La información que registras',
    paragraphs: [
      'Los saldos y reportes se calculan con los datos que tú ingresas y con los tipos de cambio que configuras. MONEO+ no se conecta a tu banco, por lo que pueden no coincidir con tus saldos reales.',
      'MONEO+ no es una entidad financiera, no guarda ni mueve dinero y no ofrece asesoría financiera, tributaria ni de inversión.',
    ],
  },
  {
    title: '4. Juntas',
    paragraphs: [
      'Las Juntas son acuerdos entre sus participantes. MONEO+ solo ofrece herramientas para organizarlas: no recibe ni custodia aportes, no garantiza los pagos de los participantes y no es parte de esos acuerdos.',
    ],
  },
  {
    title: '5. Uso aceptable',
    paragraphs: [
      'No debes usar MONEO+ para actividades ilícitas, para acceder a datos de otras personas ni para afectar el funcionamiento del servicio. Podemos suspender cuentas que incumplan estos términos.',
    ],
  },
  {
    title: '6. Disponibilidad y responsabilidad',
    paragraphs: [
      'Trabajamos para que el servicio esté disponible y funcione correctamente, pero puede tener interrupciones o errores. En la medida permitida por la ley, MONEO+ no responde por decisiones tomadas con base en la información de la app.',
    ],
  },
  {
    title: '7. Cambios y ley aplicable',
    paragraphs: [
      'Podemos actualizar estos términos; te avisaremos en la app antes de que los cambios entren en vigor.',
      'Estos términos se rigen por las leyes del Perú. Consultas: [correo de contacto].',
    ],
  },
];

export default function TerminosPage() {
  return <LegalPage title="Términos y condiciones" updated="[fecha]" sections={SECTIONS} />;
}
