// Entry point bundled for the auto-inbound Edge Function (Deno), so the server
// interprets bank emails with exactly the same code as the web app.
// Build: `npm run build:edge` (scripts/build-edge-interpreter.mjs).
export { parseBankMessage, isLikelyDuplicate, operationKey, bankForEmail } from './index';
export type { BankMessage, ParsedMovement } from './types';
