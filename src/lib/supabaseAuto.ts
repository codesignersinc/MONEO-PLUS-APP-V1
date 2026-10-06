import { createClient } from '@/lib/supabase/client';
import { DataError, toDataError } from '@/lib/dataError';
import { buildCurrencyFields, buildTransferAmounts, getRateFromMap } from '@/lib/currency';
import { getFxContext } from '@/lib/supabaseCurrency';
import { transactionsService, transfersService } from '@/lib/supabaseFinance';
import { localDateTimeToISO } from '@/lib/dates';
import { CATEGORY_PRESETS, type Account } from '@/lib/financeStore';
import { isLikelyDuplicate, operationKey } from '@/lib/auto';
import { merchantKey } from '@/lib/auto/merchant';
import type { AutoSource, BankId, MovementKind, ParsedMovement } from '@/lib/auto/types';

// MONEO AUTO inbox. Suggestions hold only interpreted fields (never the original text).
// Registering one creates a normal movement through transactionsService /
// transfersService, so the database balance engine applies it like any other.

export type SuggestionStatus = 'pendiente' | 'registrada' | 'ignorada';

export interface AutoSuggestion extends ParsedMovement {
  id: string;
  source: AutoSource;
  status: SuggestionStatus;
  transactionId: string | null;
  transferId: string | null;
  createdAt: string;
}

export interface AutoRules {
  cardAccount: Record<string, string>; // last4 → account id
  merchantCategory: Record<string, string>; // merchant key → category label
}

type Row = Record<string, unknown>;

function fromRow(r: Row): AutoSuggestion {
  const s = (k: string) => (r[k] as string | null) ?? undefined;
  return {
    id: String(r.id),
    source: r.source as AutoSource,
    bank: r.bank as BankId,
    kind: r.kind as MovementKind,
    type: r.movement_type as ParsedMovement['type'],
    amount: Number(r.amount),
    currency: r.currency as ParsedMovement['currency'],
    merchant: String(r.merchant ?? ''),
    date: String(r.occurred_date),
    time: r.occurred_time ? String(r.occurred_time).slice(0, 5) : null,
    cardLast4: s('card_last4'),
    cardType: s('card_type') as ParsedMovement['cardType'],
    destinationLast4: s('destination_last4'),
    destinationBank: s('destination_bank'),
    ownAccount: (r.own_account as boolean | null) ?? undefined,
    suggestedCategory: (r.suggested_category as string | null) ?? null,
    recurring: Boolean(r.recurring),
    status: r.status as SuggestionStatus,
    transactionId: (r.transaction_id as string | null) ?? null,
    transferId: (r.transfer_id as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type AddResult =
  | { status: 'added'; suggestion: AutoSuggestion }
  | { status: 'duplicate'; existing: AutoSuggestion | null };

export interface RegisterInput {
  accountId: string; // gasto/ingreso: the account; transferencia: origin
  toAccountId?: string; // transferencia: destination
  accountAmount?: number; // > 0, in the account's currency when it differs from the suggestion's
  categoryLabel: string;
  name: string;
  date: string; // YYYY-MM-DD
  time: string | null;
}

export const autoService = {
  async list(): Promise<AutoSuggestion[]> {
    const { data, error } = await createClient()
      .from('auto_suggestions')
      .select('*')
      .order('occurred_date', { ascending: false })
      .order('occurred_time', { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw toDataError(error);
    return (data || []).map(fromRow);
  },

  // Calls `onInsert` as soon as a new suggestion of this user is created anywhere (forwarded
  // email, another device). Realtime applies RLS. Returns the unsubscribe function.
  watch(userId: string, onInsert: (s: AutoSuggestion) => void): () => void {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    // Make sure the socket carries the user's JWT before joining (RLS on postgres_changes).
    supabase.realtime
      .setAuth()
      .catch(() => {})
      .then(() => {
        if (closed) return;
        channel = supabase
          .channel(`auto-suggestions-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'auto_suggestions',
              filter: `user_id=eq.${userId}`,
            },
            (payload) => onInsert(fromRow(payload.new as Record<string, unknown>))
          )
          .subscribe();
      });
    return () => {
      closed = true;
      if (channel) supabase.removeChannel(channel);
    };
  },

  // Adds a parsed movement to the inbox unless it is a duplicate of one already there
  // (same bank operation, or the same purchase reported by another channel).
  async add(parsed: ParsedMovement, source: AutoSource): Promise<AddResult> {
    const supabase = createClient();
    const { data: near, error: nearError } = await supabase
      .from('auto_suggestions')
      .select('*')
      .gte('occurred_date', shiftDate(parsed.date, -1))
      .lte('occurred_date', shiftDate(parsed.date, 1))
      .neq('status', 'ignorada');
    if (nearError) throw toDataError(nearError);
    // Typed entries are deliberate: two "taxi 12" the same day are two taxis. They are
    // still matched against bank notices, so the email of the same charge is not added twice.
    const existing = (near || [])
      .map(fromRow)
      .find(
        (s) => !(s.kind === 'texto' && parsed.kind === 'texto') && isLikelyDuplicate(s, parsed)
      );
    if (existing) return { status: 'duplicate', existing };

    const opKey = operationKey(parsed);
    const { data, error } = await supabase
      .from('auto_suggestions')
      .insert({
        source,
        bank: parsed.bank,
        kind: parsed.kind,
        movement_type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency,
        merchant: parsed.merchant.slice(0, 120),
        occurred_date: parsed.date,
        occurred_time: parsed.time,
        card_last4: parsed.cardLast4 ?? null,
        card_type: parsed.cardType ?? null,
        destination_last4: parsed.destinationLast4 ?? null,
        destination_bank: parsed.destinationBank?.slice(0, 40) ?? null,
        own_account: parsed.ownAccount ?? null,
        suggested_category: parsed.suggestedCategory,
        recurring: parsed.recurring,
        fingerprint: opKey ? await sha256Hex(opKey) : null,
      })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505')
        return { status: 'duplicate', existing: null };
      throw toDataError(error);
    }
    return { status: 'added', suggestion: fromRow(data) };
  },

  async setStatus(id: string, status: 'pendiente' | 'ignorada'): Promise<void> {
    const { data, error } = await createClient()
      .from('auto_suggestions')
      .update({ status, resolved_at: status === 'pendiente' ? null : new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'registrada')
      .select('id');
    if (error) throw toDataError(error);
    if (!data?.length)
      throw new DataError('conflict', undefined, 'La sugerencia ya fue registrada o no existe.');
  },

  // Registers a suggestion as a movement. The suggestion is claimed first (pendiente →
  // registrada), so a double tap cannot create two movements; if creating the movement
  // fails it goes back to pendiente.
  async register(s: AutoSuggestion, input: RegisterInput, accounts: Account[]): Promise<void> {
    const supabase = createClient();
    const { data: claimed, error: claimError } = await supabase
      .from('auto_suggestions')
      .update({ status: 'registrada', resolved_at: new Date().toISOString() })
      .eq('id', s.id)
      .eq('status', 'pendiente')
      .select('id');
    if (claimError) throw toDataError(claimError);
    if (!claimed?.length)
      throw new DataError('conflict', undefined, 'Esta sugerencia ya fue registrada.');

    try {
      const link = await createMovement(s, input, accounts);
      const { error } = await supabase.from('auto_suggestions').update(link).eq('id', s.id);
      if (error) throw toDataError(error);
    } catch (err) {
      await supabase
        .from('auto_suggestions')
        .update({ status: 'pendiente', resolved_at: null })
        .eq('id', s.id);
      throw err;
    }
    // Learning is best effort: a failure here never undoes the registered movement.
    await rulesService.learn(s, input).catch((e) => console.error(e));
  },
};

async function createMovement(
  s: AutoSuggestion,
  input: RegisterInput,
  accounts: Account[]
): Promise<{ transaction_id?: string; transfer_id?: string }> {
  const fx = await getFxContext();
  const account = accounts.find((a) => a.id === input.accountId);
  if (!account) throw new DataError('validation', undefined, 'Elige la cuenta.');
  const accCurrency = account.currency || 'PEN';
  const when = localDateTimeToISO(input.date, input.time ?? '12:00');

  if (s.type === 'transferencia') {
    const to = accounts.find((a) => a.id === input.toAccountId);
    if (!to || to.id === account.id)
      throw new DataError('validation', undefined, 'Elige la cuenta de destino.');
    const fromAmount =
      accCurrency === s.currency
        ? s.amount
        : (input.accountAmount ?? s.amount * getRateFromMap(fx.ratesMap, s.currency, accCurrency));
    const id = await transfersService.create({
      fromAccountId: account.id,
      toAccountId: to.id,
      ...buildTransferAmounts({
        fromAmount,
        fromCurrency: accCurrency,
        toCurrency: to.currency || 'PEN',
        baseCurrency: fx.baseCurrency,
        ratesMap: fx.ratesMap,
      }),
      date: when,
      name: input.name || 'Transferencia',
      notes: 'MONEO AUTO',
    });
    return { transfer_id: id };
  }

  const sign = s.type === 'gasto' ? -1 : 1;
  const sameCurrency = accCurrency === s.currency;
  const accountAmount = sameCurrency
    ? s.amount
    : (input.accountAmount ?? s.amount * getRateFromMap(fx.ratesMap, s.currency, accCurrency));
  if (!(accountAmount > 0))
    throw new DataError('validation', undefined, 'Indica el monto en la moneda de la cuenta.');
  const cat =
    CATEGORY_PRESETS.find((c) => c.label === input.categoryLabel) ??
    CATEGORY_PRESETS.find((c) => c.id === (s.type === 'ingreso' ? 'ingreso' : 'otros'))!;
  const tx = await transactionsService.create({
    name: input.name || s.merchant || 'Movimiento',
    type: s.type,
    amount: sign * accountAmount,
    category: cat.label,
    categoryIcon: cat.icon,
    accountId: account.id,
    account: account.name,
    notes: 'MONEO AUTO',
    date: when,
    time: input.time ?? '12:00',
    ...buildCurrencyFields({
      amount: sign * accountAmount,
      currency: accCurrency,
      baseCurrency: fx.baseCurrency,
      rateToBase: getRateFromMap(
        fx.ratesMap,
        sameCurrency ? accCurrency : s.currency,
        fx.baseCurrency
      ),
      date: input.date,
      original: sameCurrency ? undefined : { amount: sign * s.amount, currency: s.currency },
    }),
  });
  return { transaction_id: tx.id };
}

export const rulesService = {
  async get(): Promise<AutoRules> {
    const { data, error } = await createClient().from('auto_rules').select('*');
    if (error) throw toDataError(error);
    const rules: AutoRules = { cardAccount: {}, merchantCategory: {} };
    for (const r of data || []) {
      if (r.rule_type === 'card' && r.account_id) rules.cardAccount[r.match_key] = r.account_id;
      if (r.rule_type === 'merchant' && r.category)
        rules.merchantCategory[r.match_key] = r.category;
    }
    return rules;
  },

  // Remembers the account used for a card and the category chosen for a merchant.
  async learn(s: AutoSuggestion, input: RegisterInput): Promise<void> {
    const supabase = createClient();
    const rows: Row[] = [];
    if (s.cardLast4) {
      rows.push({
        rule_type: 'card',
        match_key: s.cardLast4,
        account_id: input.accountId,
        category: null,
      });
    }
    const key = merchantKey(s.merchant).slice(0, 80);
    if (key && s.type !== 'transferencia' && input.categoryLabel) {
      rows.push({
        rule_type: 'merchant',
        match_key: key,
        account_id: null,
        category: input.categoryLabel,
      });
    }
    for (const row of rows) {
      const { error } = await supabase
        .from('auto_rules')
        .upsert(
          { ...row, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,rule_type,match_key' }
        );
      if (error) throw toDataError(error);
    }
  },
};

const BANK_WORDS: Partial<Record<BankId, string>> = {
  bcp: 'bcp',
  bbva: 'bbva',
  interbank: 'interbank',
  yape: 'yape',
  plin: 'plin',
  scotiabank: 'scotia',
};

// Account and category to preselect for a suggestion, from learned rules first.
export function suggestDefaults(
  s: ParsedMovement,
  rules: AutoRules,
  accounts: Account[]
): { accountId: string; categoryLabel: string } {
  const byCard = s.cardLast4 ? rules.cardAccount[s.cardLast4] : undefined;
  // Otherwise, the only account of the bank named in the message ("almuerzo 18 bcp").
  const bankWord = BANK_WORDS[s.bank];
  const ofBank = bankWord
    ? accounts.filter((a) => `${a.institution ?? ''} ${a.name}`.toLowerCase().includes(bankWord))
    : [];
  const accountId =
    byCard && accounts.some((a) => a.id === byCard)
      ? byCard
      : ofBank.length === 1
        ? ofBank[0].id
        : '';
  const learned = rules.merchantCategory[merchantKey(s.merchant).slice(0, 80)];
  const categoryLabel =
    learned ??
    s.suggestedCategory ??
    (s.type === 'ingreso' ? 'Ingreso' : s.type === 'gasto' ? 'Otros' : '');
  return { accountId, categoryLabel };
}

// ─── Forwarding address (u-<token>@auto.moneo.plus) ───────────────────────────

export interface AutoAddress {
  address: string;
  lastReceivedAt: string | null;
  gmailCode: string | null;
  gmailCodeAt: string | null;
}

// Gmail filter that forwards only bank notices.
export const BANK_EMAIL_FILTER =
  'from:(notificacionesbcp.com.pe OR bcp.com.pe OR bbva.com.pe OR netinterbank.com.pe OR interbank.pe OR yape.pe)';

export const addressService = {
  async get(): Promise<AutoAddress | null> {
    const { data, error } = await createClient().from('auto_addresses').select('*').maybeSingle();
    if (error) throw toDataError(error);
    if (!data) return null;
    return {
      address: `u-${data.token}@auto.moneo.plus`,
      lastReceivedAt: data.last_received_at ?? null,
      gmailCode: data.gmail_code ?? null,
      gmailCodeAt: data.gmail_code_at ?? null,
    };
  },

  // Creates the address on first use; regenerate = true replaces it (the old one stops working).
  async create(regenerate = false): Promise<void> {
    const { error } = await createClient().rpc('get_or_create_auto_address', { regenerate });
    if (error) throw toDataError(error);
  },
};
