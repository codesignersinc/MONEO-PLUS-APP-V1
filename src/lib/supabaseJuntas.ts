'use client';

import { createClient } from '@/lib/supabase/client';
import { assertAffected, toDataError } from '@/lib/dataError';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Junta {
  id: string;
  userId: string;
  name: string;
  description: string;
  contributionAmount: number;
  frequency: string;
  maxParticipants: number;
  firstDrawDate: string;
  paymentConfirmation: string;
  paymentDeadlineDay: number;
  latePolicy: string;
  isPrivate: boolean;
  additionalNotes: string;
  status: 'activa' | 'en_pausa' | 'finalizada' | 'pendiente';
  createdAt: string;
  updatedAt: string;
}

export interface JuntaMember {
  id: string;
  juntaId: string;
  userId: string | null;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pendiente' | 'unido' | 'invitado';
  joinedAt: string | null;
  createdAt: string;
}

export interface JuntaCycle {
  id: string;
  juntaId: string;
  cycleNumber: number;
  cycleMonth: string;
  cycleYear: number;
  totalExpected: number;
  totalCollected: number;
  status: 'activo' | 'completado' | 'pendiente';
  drawWinnerMemberId: string | null;
  drawPerformedAt: string | null;
  drawSeed: string | null;
  createdAt: string;
}

export interface JuntaTurn {
  id: string;
  juntaId: string;
  memberId: string;
  turnOrder: number;
  turnMonth: string;
  turnYear: number;
  amountToReceive: number;
  status: 'pendiente' | 'recibido' | 'proximo';
  createdAt: string;
}

export interface JuntaContribution {
  id: string;
  juntaId: string;
  cycleId: string;
  memberId: string;
  userId: string | null;
  amount: number;
  paymentMethod: 'yape' | 'plin' | 'transferencia' | 'efectivo';
  status: 'pendiente' | 'pagado' | 'verificado';
  receiptUrl: string;
  notes: string;
  paidAt: string | null;
  transactionType: string;
  createdAt: string;
}

export interface JuntaInvite {
  id: string;
  juntaId: string;
  inviteCode: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface JuntaEvent {
  id: string;
  juntaId: string;
  actorMemberId: string | null;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapJunta(r: Record<string, unknown>): Junta {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    description: (r.description as string) || '',
    contributionAmount: Number(r.contribution_amount),
    frequency: r.frequency as string,
    maxParticipants: Number(r.max_participants),
    firstDrawDate: r.first_draw_date as string,
    paymentConfirmation: r.payment_confirmation as string,
    paymentDeadlineDay: Number(r.payment_deadline_day),
    latePolicy: r.late_policy as string,
    isPrivate: r.is_private as boolean,
    additionalNotes: (r.additional_notes as string) || '',
    status: r.status as Junta['status'],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapMember(r: Record<string, unknown>): JuntaMember {
  return {
    id: r.id as string,
    juntaId: r.junta_id as string,
    userId: r.user_id as string | null,
    displayName: r.display_name as string,
    email: (r.email as string) || '',
    role: r.role as JuntaMember['role'],
    status: r.status as JuntaMember['status'],
    joinedAt: r.joined_at as string | null,
    createdAt: r.created_at as string,
  };
}

function mapCycle(r: Record<string, unknown>): JuntaCycle {
  return {
    id: r.id as string,
    juntaId: r.junta_id as string,
    cycleNumber: Number(r.cycle_number),
    cycleMonth: r.cycle_month as string,
    cycleYear: Number(r.cycle_year),
    totalExpected: Number(r.total_expected),
    totalCollected: Number(r.total_collected),
    status: r.status as JuntaCycle['status'],
    drawWinnerMemberId: r.draw_winner_member_id as string | null,
    drawPerformedAt: r.draw_performed_at as string | null,
    drawSeed: r.draw_seed as string | null,
    createdAt: r.created_at as string,
  };
}

function mapTurn(r: Record<string, unknown>): JuntaTurn {
  return {
    id: r.id as string,
    juntaId: r.junta_id as string,
    memberId: r.member_id as string,
    turnOrder: Number(r.turn_order),
    turnMonth: r.turn_month as string,
    turnYear: Number(r.turn_year),
    amountToReceive: Number(r.amount_to_receive),
    status: r.status as JuntaTurn['status'],
    createdAt: r.created_at as string,
  };
}

function mapContribution(r: Record<string, unknown>): JuntaContribution {
  return {
    id: r.id as string,
    juntaId: r.junta_id as string,
    cycleId: r.cycle_id as string,
    memberId: r.member_id as string,
    userId: r.user_id as string | null,
    amount: Number(r.amount),
    paymentMethod: r.payment_method as JuntaContribution['paymentMethod'],
    status: r.status as JuntaContribution['status'],
    receiptUrl: (r.receipt_url as string) || '',
    notes: (r.notes as string) || '',
    paidAt: r.paid_at as string | null,
    transactionType: r.transaction_type as string,
    createdAt: r.created_at as string,
  };
}

function mapEvent(r: Record<string, unknown>): JuntaEvent {
  return {
    id: r.id as string,
    juntaId: r.junta_id as string,
    actorMemberId: r.actor_member_id as string | null,
    eventType: r.event_type as string,
    description: r.description as string,
    metadata: (r.metadata as Record<string, unknown>) || {},
    createdAt: r.created_at as string,
  };
}

// ─── Juntas Service ───────────────────────────────────────────────────────────

export const juntasService = {
  async getAll(): Promise<Junta[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('juntas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => mapJunta(r as Record<string, unknown>));
  },

  // Resolves null when the junta does not exist (or is not visible to the user);
  // throws a DataError when the request itself fails.
  async getById(id: string): Promise<Junta | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('juntas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw toDataError(error);
    if (!data) return null;
    return mapJunta(data as Record<string, unknown>);
  },

  async create(junta: Omit<Junta, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Junta | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('juntas')
      .insert({
        user_id: user.id,
        name: junta.name,
        description: junta.description,
        contribution_amount: junta.contributionAmount,
        frequency: junta.frequency,
        max_participants: junta.maxParticipants,
        first_draw_date: junta.firstDrawDate,
        payment_confirmation: junta.paymentConfirmation,
        payment_deadline_day: junta.paymentDeadlineDay,
        late_policy: junta.latePolicy,
        is_private: junta.isPrivate,
        additional_notes: junta.additionalNotes,
        status: junta.status,
      })
      .select()
      .single();
    if (error) throw error;
    return mapJunta(data as Record<string, unknown>);
  },

  async update(id: string, updates: Partial<Junta>): Promise<void> {
    const supabase = createClient();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.contributionAmount !== undefined) payload.contribution_amount = updates.contributionAmount;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.maxParticipants !== undefined) payload.max_participants = updates.maxParticipants;
    const { data, error } = await supabase.from('juntas').update(payload).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Members Service ──────────────────────────────────────────────────────────

export const juntaMembersService = {
  async getByJunta(juntaId: string): Promise<JuntaMember[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_members')
      .select('*')
      .eq('junta_id', juntaId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => mapMember(r as Record<string, unknown>));
  },

  async create(member: Omit<JuntaMember, 'id' | 'createdAt'>): Promise<JuntaMember | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_members')
      .insert({
        junta_id: member.juntaId,
        user_id: member.userId,
        display_name: member.displayName,
        email: member.email,
        role: member.role,
        status: member.status,
        joined_at: member.joinedAt,
      })
      .select()
      .single();
    if (error) throw error;
    return mapMember(data as Record<string, unknown>);
  },

  async update(id: string, updates: Partial<JuntaMember>): Promise<void> {
    const supabase = createClient();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.displayName !== undefined) payload.display_name = updates.displayName;
    if (updates.joinedAt !== undefined) payload.joined_at = updates.joinedAt;
    const { data, error } = await supabase.from('junta_members').update(payload).eq('id', id).select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Cycles Service ───────────────────────────────────────────────────────────

export const juntaCyclesService = {
  async getByJunta(juntaId: string): Promise<JuntaCycle[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_cycles')
      .select('*')
      .eq('junta_id', juntaId)
      .order('cycle_number', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => mapCycle(r as Record<string, unknown>));
  },

  async create(cycle: Omit<JuntaCycle, 'id' | 'createdAt'>): Promise<JuntaCycle | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_cycles')
      .insert({
        junta_id: cycle.juntaId,
        cycle_number: cycle.cycleNumber,
        cycle_month: cycle.cycleMonth,
        cycle_year: cycle.cycleYear,
        total_expected: cycle.totalExpected,
        total_collected: cycle.totalCollected,
        status: cycle.status,
        draw_winner_member_id: cycle.drawWinnerMemberId,
        draw_performed_at: cycle.drawPerformedAt,
        draw_seed: cycle.drawSeed,
      })
      .select()
      .single();
    if (error) throw error;
    return mapCycle(data as Record<string, unknown>);
  },

  async performDraw(cycleId: string, winnerMemberId: string, seed: string): Promise<void> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_cycles')
      .update({
        draw_winner_member_id: winnerMemberId,
        draw_performed_at: new Date().toISOString(),
        draw_seed: seed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cycleId)
      .select('id');
    if (error) throw toDataError(error);
    assertAffected(data);
  },
};

// ─── Turns Service ────────────────────────────────────────────────────────────

export const juntaTurnsService = {
  async getByJunta(juntaId: string): Promise<JuntaTurn[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_turns')
      .select('*')
      .eq('junta_id', juntaId)
      .order('turn_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => mapTurn(r as Record<string, unknown>));
  },

  async createMany(turns: Omit<JuntaTurn, 'id' | 'createdAt'>[]): Promise<void> {
    const supabase = createClient();
    const rows = turns.map(t => ({
      junta_id: t.juntaId,
      member_id: t.memberId,
      turn_order: t.turnOrder,
      turn_month: t.turnMonth,
      turn_year: t.turnYear,
      amount_to_receive: t.amountToReceive,
      status: t.status,
    }));
    const { error } = await supabase.from('junta_turns').insert(rows);
    if (error) throw error;
  },
};

// ─── Contributions Service ────────────────────────────────────────────────────

export const juntaContributionsService = {
  async getByCycle(cycleId: string): Promise<JuntaContribution[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_contributions')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(r => mapContribution(r as Record<string, unknown>));
  },

  async create(contribution: Omit<JuntaContribution, 'id' | 'createdAt'>): Promise<JuntaContribution | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_contributions')
      .insert({
        junta_id: contribution.juntaId,
        cycle_id: contribution.cycleId,
        member_id: contribution.memberId,
        user_id: contribution.userId,
        amount: contribution.amount,
        payment_method: contribution.paymentMethod,
        status: contribution.status,
        receipt_url: contribution.receiptUrl,
        notes: contribution.notes,
        paid_at: contribution.paidAt,
        transaction_type: contribution.transactionType,
      })
      .select()
      .single();
    if (error) throw error;
    return mapContribution(data as Record<string, unknown>);
  },
};

// ─── Invites Service ──────────────────────────────────────────────────────────

export const juntaInvitesService = {
  async getByJunta(juntaId: string): Promise<JuntaInvite[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_invites')
      .select('*')
      .eq('junta_id', juntaId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id as string,
      juntaId: r.junta_id as string,
      inviteCode: r.invite_code as string,
      createdBy: r.created_by as string,
      expiresAt: r.expires_at as string | null,
      maxUses: r.max_uses as number | null,
      useCount: Number(r.use_count),
      isActive: r.is_active as boolean,
      createdAt: r.created_at as string,
    }));
  },

  async create(juntaId: string, code: string): Promise<JuntaInvite | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('junta_invites')
      .insert({
        junta_id: juntaId,
        invite_code: code,
        created_by: user.id,
        is_active: true,
        use_count: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      juntaId: data.junta_id,
      inviteCode: data.invite_code,
      createdBy: data.created_by,
      expiresAt: data.expires_at,
      maxUses: data.max_uses,
      useCount: data.use_count,
      isActive: data.is_active,
      createdAt: data.created_at,
    };
  },
};

// ─── Events Service ───────────────────────────────────────────────────────────

export const juntaEventsService = {
  async getByJunta(juntaId: string): Promise<JuntaEvent[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('junta_events')
      .select('*')
      .eq('junta_id', juntaId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(r => mapEvent(r as Record<string, unknown>));
  },

  async create(event: Omit<JuntaEvent, 'id' | 'createdAt'>): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('junta_events').insert({
      junta_id: event.juntaId,
      actor_member_id: event.actorMemberId,
      event_type: event.eventType,
      description: event.description,
      metadata: event.metadata,
    });
    if (error) throw error;
  },
};

// ─── Notification Architecture (prepared for future push notifications) ───────

export type JuntaNotificationType =
  | 'proximo_aporte' |'aporte_pendiente' |'aporte_confirmado' |'sorteo_proximo' |'resultado_sorteo' |'turno_proximo' |'junta_completada';

export interface JuntaNotificationPayload {
  type: JuntaNotificationType;
  juntaId: string;
  juntaName: string;
  amount?: number;
  memberName?: string;
  month?: string;
}

// Prepared notification dispatcher — connects to push service when available
export function prepareJuntaNotification(payload: JuntaNotificationPayload): void {
  // Architecture hook: log event for future push notification integration
  juntaEventsService.create({
    juntaId: payload.juntaId,
    actorMemberId: null,
    eventType: `notification_${payload.type}`,
    description: `Notificación preparada: ${payload.type}`,
    metadata: payload as unknown as Record<string, unknown>,
  }).catch(() => {/* silent */});
}
