import type { Metadata } from 'next';
import LegalPage, { type LegalSection } from '@/components/legal/LegalPage';
import { LEGAL } from '@/lib/legal';

// Account deletion page required by Google Play (Data safety → account deletion URL).
export const metadata: Metadata = {
  title: 'Eliminar tu cuenta · MONEO+',
  description: 'Cómo eliminar tu cuenta de MONEO+ y qué datos se borran.',
};

const SECTIONS: LegalSection[] = [
  {
    title: 'Eliminar tu cuenta de MONEO+',
    paragraphs: [
      `Esta página explica cómo eliminar tu cuenta de MONEO+ (app «MONEO+ Finanzas y Negocio» en Google Play, desarrollada por ${LEGAL.owner}) y qué pasa con tus datos.`,
    ],
  },
  {
    title: 'Desde la app (inmediato)',
    paragraphs: [
      '1. Abre MONEO+ e inicia sesión.',
      '2. Ve a Más → Configuración.',
      '3. Baja hasta «Eliminar cuenta».',
      '4. Escribe ELIMINAR para confirmar y toca «Eliminar mi cuenta».',
      'Tu cuenta se elimina en ese momento y se cierra tu sesión. Si organizas una Junta activa, primero debes cerrarla o transferirla.',
    ],
  },
  {
    title: 'Si no puedes entrar a la app',
    paragraphs: [
      `Escríbenos a ${LEGAL.email} desde el correo de tu cuenta con el asunto «Eliminar mi cuenta». La eliminamos en un plazo máximo de 7 días y te confirmamos por correo.`,
    ],
  },
  {
    title: 'Qué se borra',
    paragraphs: [
      'Todo lo asociado a tu cuenta: nombre, correo y contraseña; cuentas, saldos y movimientos; pagos, ingresos, suscripciones, presupuestos, metas, deudas e inversiones; tus negocios de MONEO NEGOCIO con sus clientes, proveedores y equipo; sugerencias y reglas de MONEO AUTO, la conexión con Gmail y tu dirección de reenvío; widgets y dispositivos vinculados; y tu participación en MONEO HOGAR.',
      'También puedes borrar datos sueltos sin eliminar la cuenta: cada movimiento, cuenta, meta, pago o contacto tiene su opción «Eliminar», y puedes desconectar Gmail desde MONEO AUTO.',
    ],
  },
  {
    title: 'Qué se conserva y por cuánto tiempo',
    paragraphs: [
      'Los registros de pagos de MONEO PLUS (plan, monto, fecha y número de operación de Mercado Pago) se conservan el tiempo que exigen las normas tributarias del Perú.',
      'En las Juntas de otras personas, tu nombre puede seguir apareciendo en el historial de esa Junta para sus demás participantes.',
      'Las copias de seguridad de nuestros proveedores se eliminan automáticamente en sus ciclos de rotación.',
    ],
  },
];

export default function EliminarCuentaPage() {
  return <LegalPage title="Eliminar tu cuenta" updated={LEGAL.updated} sections={SECTIONS} />;
}
