// MONEO HOGAR: reading a household budget spreadsheet (Excel or CSV) into expense rows.
// Pure functions: the file is read in the browser and nothing is stored until the user
// reviews the preview and confirms.
//
// Two layouts are understood:
//   * one row per expense, with columns like Persona / Categoría / Descripción / Monto /
//     Periodicidad (any order, Spanish or English names);
//   * one column per person (e.g. Concepto | Félix | Sophia), each cell an amount.

import type { Frequency, HouseholdMember } from '@/lib/household';

export type Cell = string | number | boolean | Date | null | undefined;

export interface ImportRow {
  key: string;
  include: boolean;
  // A member id, 'shared' (Ambos / Hogar) or null when the name did not match anybody.
  person: string | null;
  personLabel: string;
  description: string;
  category: string;
  amount: number;
  frequency: Frequency | null; // null = one-time
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const text = (c: Cell) =>
  c === null || c === undefined
    ? ''
    : c instanceof Date
      ? c.toISOString().slice(0, 10)
      : String(c).trim();

// ---------- CSV ----------

// Minimal CSV reader: comma or semicolon (whichever the header uses more), quoted fields.
export function parseCsv(input: string): string[][] {
  const src = input.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---------- Values ----------

// "S/ 2,600.00", "2.600,00", "2600", 2600 → 2600. Null when it is not an amount.
export function parseAmount(c: Cell): number | null {
  if (typeof c === 'number') return isFinite(c) ? Math.round(Math.abs(c) * 100) / 100 : null;
  let s = text(c)
    .replace(/s\/\.?|pen|usd|us\$|\$|€|soles?/gi, '')
    .replace(/\s/g, '');
  if (!s || !/\d/.test(s) || /[a-z]/i.test(s)) return null;
  s = s.replace(/^-/, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // The last separator is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // "2,600" (thousands) vs "26,50" (decimals).
    s =
      /,\d{3}$/.test(s) && s.indexOf(',') === lastComma ? s.replace(',', '') : s.replace(',', '.');
  } else if (lastDot > -1 && /\.\d{3}$/.test(s) && (s.match(/\./g)?.length ?? 0) > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function parseFrequency(c: Cell): Frequency | null | undefined {
  const s = fold(text(c));
  if (!s) return undefined;
  if (/semanal|semana|weekly/.test(s)) return 'weekly';
  if (/anual|ano|year/.test(s)) return 'yearly';
  if (/unic|una vez|eventual|once/.test(s)) return null;
  if (/mensual|mes|month|fijo/.test(s)) return 'monthly';
  return undefined;
}

// Category of MONEO's presets for a category cell or, failing that, the description.
const CATEGORY_RULES: [RegExp, string][] = [
  // Before Transporte: "Seguro auto" is insurance.
  [/seguro|poliza|eps|soat/, 'Seguros'],
  [/alquiler|renta|hipoteca|vivienda|mantenimiento|condominio|predial|arbitrios/, 'Vivienda'],
  [
    /luz|agua|internet|telefono|celular|cable|gas\b|servicio|movistar|claro|entel|win|bitel/,
    'Servicios',
  ],
  [/super|mercado|abarrote|plaza vea|tottus|wong|metro|vivanda|alimenta|despensa/, 'Supermercado'],
  [/delivery|restaurant|comida|almuerzo|cena|rappi|pedidos/, 'Comida'],
  [
    /gasolina|combustible|grifo|taxi|uber|transporte|cochera|peaje|camioneta|auto|carro|mazda|toyota/,
    'Transporte',
  ],
  [/colegio|nido|pension|nana|hijo|ninos|ninera|guarderia|uniforme/, 'Hijos'],
  [/netflix|spotify|disney|hbo|prime|suscrip|youtube|icloud/, 'Suscripciones'],
  [/salud|medic|farmacia|clinica|dentista/, 'Salud'],
  [/universidad|curso|educacion|libro/, 'Educación'],
  [/cine|salida|entreten|viaje|vacacion/, 'Entretenimiento'],
  [/limpieza|hogar|casa|muebles|electro/, 'Hogar'],
];

export function guessCategory(category: string, description: string): string {
  const c = fold(category);
  const exact: Record<string, string> = {
    vivienda: 'Vivienda',
    servicios: 'Servicios',
    alimentacion: 'Supermercado',
    supermercado: 'Supermercado',
    comida: 'Comida',
    transporte: 'Transporte',
    hijos: 'Hijos',
    hogar: 'Hogar',
    seguros: 'Seguros',
    suscripciones: 'Suscripciones',
    salud: 'Salud',
    educacion: 'Educación',
    entretenimiento: 'Entretenimiento',
    otros: 'Otros',
  };
  if (exact[c]) return exact[c];
  for (const [re, label] of CATEGORY_RULES) if (re.test(c)) return label;
  const d = fold(description);
  for (const [re, label] of CATEGORY_RULES) if (re.test(d)) return label;
  return 'Otros';
}

// A person cell → member id, 'shared' or null (unknown).
export function matchPerson(label: string, members: HouseholdMember[]): string | null {
  const s = fold(label);
  if (!s) return null;
  if (/^(ambos|hogar|casa|todos|compartido|familia|los dos|nosotros)/.test(s)) return 'shared';
  const active = members.filter((m) => m.status === 'active');
  const hit =
    active.find((m) => fold(m.displayName) === s) ??
    active.find((m) => fold(m.displayName).split(/\s+/)[0] === s.split(/\s+/)[0]);
  return hit?.id ?? null;
}

// ---------- Layout detection ----------

type Col = 'person' | 'category' | 'description' | 'amount' | 'frequency';

const HEADER: [Col, RegExp][] = [
  ['person', /^(persona|quien|responsable|paga|pagador|miembro|nombre|person|who)/],
  ['category', /^(categoria|rubro|tipo de gasto|category)/],
  ['description', /^(descripcion|concepto|detalle|gasto|item|description|concept)/],
  ['amount', /^(monto|importe|total|valor|costo|precio|s\/|amount|soles)/],
  ['frequency', /^(periodicidad|frecuencia|periodo|tipo|frequency)/],
];

function headerRole(c: Cell): Col | null {
  const s = fold(text(c));
  if (!s) return null;
  return HEADER.find(([, re]) => re.test(s))?.[0] ?? null;
}

const isTotal = (s: string) => /^(sub)?total|^suma|^gasto total|^total general/.test(fold(s));

// Reads the rows of a sheet into expenses. `members` lets the one-column-per-person layout
// and the person column be recognised.
export function readSheet(rows: Cell[][], members: HouseholdMember[]): ImportRow[] {
  const out: ImportRow[] = [];
  const push = (r: Omit<ImportRow, 'key' | 'include'>) =>
    out.push({ ...r, key: String(out.length), include: true });

  // Header: the first of the first 10 rows that names at least 2 known columns (or a
  // description column and at least one member).
  let headerAt = -1;
  let roles: (Col | null)[] = [];
  let personCols: { idx: number; person: string | null; label: string }[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] ?? [];
    const rr = r.map(headerRole);
    const pcs = r
      .map((c, idx) => ({ idx, label: text(c), person: matchPerson(text(c), members) }))
      .filter((p) => p.person && rr[p.idx] === null);
    const known = new Set(rr.filter(Boolean)).size;
    if (known >= 2 || (rr.includes('description') && pcs.length > 0)) {
      headerAt = i;
      roles = rr;
      personCols = pcs;
      break;
    }
  }

  const body = rows.slice(headerAt + 1);
  const col = (r: Cell[], role: Col) => {
    const i = roles.indexOf(role);
    return i < 0 ? undefined : r[i];
  };

  for (const r of body) {
    if (!r || r.every((c) => text(c) === '')) continue;
    let description = text(col(r, 'description'));
    if (headerAt < 0 || !description) {
      // No header (or no description column): first text cell that is not an amount.
      description = r.map(text).find((t) => t && parseAmount(t) === null) ?? '';
    }
    if (!description || isTotal(description)) continue;
    const category = guessCategory(text(col(r, 'category')), description);
    const freq = parseFrequency(col(r, 'frequency'));
    const frequency = freq === undefined ? 'monthly' : freq;

    if (personCols.length > 0) {
      // One column per person.
      for (const pc of personCols) {
        const amount = parseAmount(r[pc.idx]);
        if (amount)
          push({
            person: pc.person,
            personLabel: pc.label,
            description,
            category,
            amount,
            frequency,
          });
      }
      continue;
    }
    const amountCell = col(r, 'amount');
    const amount =
      parseAmount(amountCell) ??
      // No amount column: last numeric cell of the row.
      [...r]
        .reverse()
        .map(parseAmount)
        .find((n) => n !== null) ??
      null;
    if (!amount) continue;
    const personLabel = text(col(r, 'person'));
    push({
      person: personLabel ? matchPerson(personLabel, members) : null,
      personLabel,
      description,
      category,
      amount,
      frequency,
    });
  }
  return out;
}

export interface ImportSummary {
  count: number;
  monthlyCount: number;
  byPerson: { person: string | null; label: string; total: number }[];
  total: number;
}

// "Esto encontramos": totals of the included rows (monthly equivalent of each one).
export function summarize(rows: ImportRow[], members: HouseholdMember[]): ImportSummary {
  const inc = rows.filter((r) => r.include);
  const monthly = (r: ImportRow) =>
    r.frequency === 'weekly'
      ? (r.amount * 52) / 12
      : r.frequency === 'yearly'
        ? r.amount / 12
        : r.amount;
  const map = new Map<string, { person: string | null; label: string; total: number }>();
  for (const r of inc) {
    const key = r.person ?? `?${r.personLabel}`;
    const label =
      r.person === 'shared'
        ? 'Ambos'
        : (members.find((m) => m.id === r.person)?.displayName ?? (r.personLabel || 'Sin asignar'));
    const cur = map.get(key) ?? { person: r.person, label, total: 0 };
    cur.total = Math.round((cur.total + monthly(r)) * 100) / 100;
    map.set(key, cur);
  }
  return {
    count: inc.length,
    monthlyCount: inc.filter((r) => r.frequency === 'monthly').length,
    byPerson: [...map.values()],
    total: Math.round(inc.reduce((s, r) => s + monthly(r), 0) * 100) / 100,
  };
}

// Reads an .xlsx (first sheet with data) or .csv file in the browser. The Excel reader is
// loaded only here, when someone imports.
export async function readSpreadsheetFile(file: File): Promise<Cell[][]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error('Sube un archivo .xlsx o .csv (en Excel: Archivo › Guardar como).');
  }
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = (await readXlsxFile(file)) as { sheet: string; data: Cell[][] }[];
  const withData = sheets.find((s) => s.data.some((r) => r.some((c) => c !== null && c !== '')));
  return withData?.data ?? [];
}
