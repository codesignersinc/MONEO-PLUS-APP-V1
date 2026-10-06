// MONEO AUTO: types shared by the bank-message interpreter.
//
// Privacy: a ParsedMovement only carries what MONEO needs to suggest a movement. Names
// of the user, phone numbers, security codes, service account numbers, receipt numbers
// and full card/account numbers are never extracted. The original text is not kept.

export type AutoSource = 'email' | 'notification' | 'sms' | 'text';

export type BankId = 'bcp' | 'bbva' | 'interbank' | 'yape' | 'plin';

export interface BankMessage {
  source: AutoSource;
  text: string;
  // Email: the From address. Notification: the app name or package (e.g. "Yape").
  sender?: string;
  subject?: string;
  // When the message arrived; used when the text carries no date or no year.
  receivedAt: Date;
}

export type MovementKind =
  | 'consumo'
  | 'pago_recurrente'
  | 'pago_servicio'
  | 'yape_enviado'
  | 'yape_recibido'
  | 'plin_recibido'
  | 'transferencia';

export interface ParsedMovement {
  bank: BankId;
  kind: MovementKind;
  type: 'gasto' | 'ingreso' | 'transferencia';
  amount: number; // always positive; the sign comes from `type`
  currency: 'PEN' | 'USD';
  // Merchant or company for purchases; counterpart's display name for Yape/Plin.
  merchant: string;
  date: string; // YYYY-MM-DD (local)
  time: string | null; // HH:MM (24 h)
  cardLast4?: string;
  cardType?: 'debito' | 'credito';
  // Transfers: last 4 of the destination account, its bank and whether it is the
  // user's own account (then it is a transfer between accounts, not an expense).
  destinationLast4?: string;
  destinationBank?: string;
  ownAccount?: boolean;
  // Bank operation number; only used to build a duplicate fingerprint.
  operationId?: string;
  suggestedCategory: string | null;
  recurring: boolean;
}
