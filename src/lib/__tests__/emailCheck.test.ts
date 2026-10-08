import { describe, expect, it } from 'vitest';
import { signupEmailProblem } from '@/lib/emailCheck';
import { authErrorMessage } from '@/lib/authErrors';

describe('signupEmailProblem', () => {
  it('accepts real-looking addresses', () => {
    for (const e of [
      'codesignersperu@gmail.com',
      'jorge.alberti+moneo@gmail.com',
      'ana@hotmail.com',
      'a@empresa.pe',
      'Mijedotri180593@Gmail.com',
    ]) {
      expect(signupEmailProblem(e), e).toBeNull();
    }
  });

  it('rejects invented Gmail addresses', () => {
    expect(signupEmailProblem('x@gmail.com')).toBe('Ese correo de Gmail no existe. Revísalo.');
    expect(signupEmailProblem('abc@gmail.com')).not.toBeNull();
    expect(signupEmailProblem('a_b_cdefg@gmail.com')).not.toBeNull();
  });

  it('rejects test, reserved and disposable domains', () => {
    expect(signupEmailProblem('prueba@test.com')).toMatch(/correo real/);
    expect(signupEmailProblem('test@prueba.com')).toMatch(/correo real/);
    expect(signupEmailProblem('yo@example.org')).toMatch(/correo real/);
    expect(signupEmailProblem('yo@algo.local')).toMatch(/correo real/);
    expect(signupEmailProblem('yo@yopmail.com')).toMatch(/temporales/);
    expect(signupEmailProblem('yo@mailinator.com')).toMatch(/temporales/);
  });

  it('suggests the right domain on typos', () => {
    expect(signupEmailProblem('jorge@gmial.com')).toBe('¿Quisiste decir jorge@gmail.com?');
    expect(signupEmailProblem('ana@hotmial.com')).toBe('¿Quisiste decir ana@hotmail.com?');
  });

  it('rejects bad syntax', () => {
    for (const e of ['', 'jorge', 'jorge@', '@gmail.com', 'jorge@gmail', 'a..b@empresa.pe']) {
      expect(signupEmailProblem(e), e).toBe('Ingresa un correo válido.');
    }
  });
});

describe('authErrorMessage', () => {
  it('shows the database hook message', () => {
    expect(authErrorMessage(new Error('MONEO: No aceptamos correos temporales.'))).toBe(
      'No aceptamos correos temporales.'
    );
  });
});
