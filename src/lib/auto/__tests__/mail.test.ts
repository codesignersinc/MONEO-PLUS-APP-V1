import { describe, expect, it } from 'vitest';
import { decodeBase64Url, gmailBankQuery, gmailBodies, gmailHeader, maskEmail } from '../mail';
import { bankForEmail } from '../index';

const b64url = (s: string) =>
  Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

describe('gmailBankQuery', () => {
  it('only searches trusted bank senders after the given time', () => {
    const q = gmailBankQuery(1760000000.7);
    expect(q).toContain('from:(');
    expect(q).toContain('notificacionesbcp.com.pe');
    expect(q).toContain('yape.pe');
    expect(q).toContain('after:1760000000 ');
    // every domain in the query is accepted by the interpreter's allowlist
    const domains = q.match(/from:\(([^)]+)\)/)![1].split(' OR ');
    for (const d of domains) expect(bankForEmail(`avisos@${d}`)).not.toBeNull();
  });
});

describe('maskEmail', () => {
  it('keeps only enough to recognize the mailbox', () => {
    expect(maskEmail('Jorge.Alberti@gmail.com')).toBe('jo***i@gmail.com');
    expect(maskEmail('ab@outlook.com')).toBe('a***@outlook.com');
    expect(maskEmail('nada')).toBe('***');
  });
});

describe('gmailBodies', () => {
  it('decodes UTF-8 text and html parts of a multipart message', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      headers: [{ name: 'From', value: 'BCP <notificaciones@notificacionesbcp.com.pe>' }],
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('Consumo S/ 25.50 en Café Ñuñoa') } },
            { mimeType: 'text/html', body: { data: b64url('<p>Consumo <b>S/ 25.50</b></p>') } },
          ],
        },
        { mimeType: 'application/pdf', body: { size: 100 } },
      ],
    };
    expect(gmailBodies(payload)).toEqual({
      text: 'Consumo S/ 25.50 en Café Ñuñoa',
      html: '<p>Consumo <b>S/ 25.50</b></p>',
    });
    expect(gmailHeader(payload, 'from')).toContain('notificacionesbcp.com.pe');
    expect(gmailHeader(payload, 'subject')).toBe('');
  });

  it('decodes base64url without padding', () => {
    expect(decodeBase64Url(b64url('¿?>>'))).toBe('¿?>>');
  });
});
