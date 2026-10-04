import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '@/lib/authErrors';

describe('authErrorMessage', () => {
  it('translates common Supabase Auth errors', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe(
      'Correo o contraseña incorrectos.'
    );
    expect(authErrorMessage(new Error('User already registered'))).toBe(
      'Ya existe una cuenta con ese correo.'
    );
    expect(authErrorMessage(new Error('Unsupported provider: provider is not enabled'))).toBe(
      'Este método de acceso todavía no está disponible.'
    );
  });

  it('falls back to a generic message', () => {
    expect(authErrorMessage(new Error('boom'), 'Error')).toBe('Error');
    expect(authErrorMessage(null)).toBe('Ocurrió un error. Intenta de nuevo.');
  });
});
