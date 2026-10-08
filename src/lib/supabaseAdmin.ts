import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';

// Admin panel data. The database only answers these to users listed in app_admins and
// returns counts of records, never amounts or other financial content.

export interface AdminUserRow {
  userId: string;
  email: string;
  fullName: string;
  provider: string;
  createdAt: string;
  lastSignInAt: string | null;
  cuentas: number;
  gastos: number;
  ingresos: number;
  transferencias: number;
  pagos: number;
  cobros: number;
  suscripciones: number;
  deudas: number;
  metas: number;
  juntasOrganiza: number;
  juntasParticipa: number;
  ultimoMovimiento: string | null;
}

export interface AdminCountryRow {
  code: string | null;
  name: string;
  flag: string;
  status: string | null;
  users: number;
  confirmed: number;
}

export const adminService = {
  async isAdmin(): Promise<boolean> {
    const { data, error } = await createClient().rpc('is_app_admin');
    if (error) throw toDataError(error);
    return data === true;
  },

  /** Deletes the user and all their data, like «Eliminar cuenta» (admin_delete_user). */
  async deleteUser(userId: string): Promise<void> {
    const { error } = await createClient().rpc('admin_delete_user', { p_user: userId });
    // The database explains why (own account, another admin, an active Junta…).
    if (error) throw new DataError(toDataError(error).kind, error, error.message);
  },

  async getUsers(): Promise<AdminUserRow[]> {
    const { data, error } = await createClient().rpc('admin_users_overview');
    if (error) throw toDataError(error);
    return ((data as Record<string, unknown>[]) || []).map((r) => ({
      userId: String(r.user_id),
      email: String(r.email ?? ''),
      fullName: String(r.full_name ?? ''),
      provider: String(r.provider ?? 'email'),
      createdAt: String(r.created_at),
      lastSignInAt: (r.last_sign_in_at as string) ?? null,
      cuentas: Number(r.cuentas),
      gastos: Number(r.gastos),
      ingresos: Number(r.ingresos),
      transferencias: Number(r.transferencias),
      pagos: Number(r.pagos),
      cobros: Number(r.cobros),
      suscripciones: Number(r.suscripciones),
      deudas: Number(r.deudas),
      metas: Number(r.metas),
      juntasOrganiza: Number(r.juntas_organiza),
      juntasParticipa: Number(r.juntas_participa),
      ultimoMovimiento: (r.ultimo_movimiento as string) ?? null,
    }));
  },
  /** Users per country (counts only). The last row (code null) is "Sin país". */
  async countryStats(): Promise<AdminCountryRow[]> {
    const { data, error } = await createClient().rpc('admin_country_stats');
    if (error) throw toDataError(error);
    return ((data as Record<string, unknown>[]) || []).map((r) => ({
      code: (r.code as string) ?? null,
      name: String(r.name ?? ''),
      flag: String(r.flag ?? ''),
      status: (r.status as string) ?? null,
      users: Number(r.users),
      confirmed: Number(r.confirmed),
    }));
  },
};
