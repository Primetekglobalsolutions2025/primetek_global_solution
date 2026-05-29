import { describe, it, expect, beforeEach } from 'vitest';
import { createToken, verifyToken, createCaptchaToken, verifyCaptchaToken } from '@/lib/auth';

describe('Auth Cryptography — auth.ts', () => {
  const payload = {
    id: 'test-user-id-123',
    email: 'user@example.com',
    role: 'employee',
    name: 'Test User',
  };

  describe('JWT Token Generation & Verification', () => {
    it('generates a valid JWT token that resolves to the same payload', async () => {
      const token = await createToken(payload);
      expect(token).toBeTypeOf('string');
      expect(token.length).toBeGreaterThan(10);

      const decoded = await verifyToken(token);
      expect(decoded).not.toBeNull();
      if (decoded) {
        expect(decoded.id).toBe(payload.id);
        expect(decoded.email).toBe(payload.email);
        expect(decoded.role).toBe(payload.role);
        expect(decoded.name).toBe(payload.name);
      }
    });

    it('returns null when verifying a tampered token', async () => {
      const token = await createToken(payload);
      const tampered = token + 'manipulated';
      const decoded = await verifyToken(tampered);
      expect(decoded).toBeNull();
    });

    it('returns null for an invalid or malformed token string', async () => {
      const decoded = await verifyToken('not-a-valid-token');
      expect(decoded).toBeNull();
    });

    it('handles payload fields correctly including mfa_pending', async () => {
      const mfaPayload = { ...payload, mfa_pending: true };
      const token = await createToken(mfaPayload);
      const decoded = await verifyToken(token);
      expect(decoded).not.toBeNull();
      if (decoded) {
        expect(decoded.mfa_pending).toBe(true);
      }
    });
  });

  describe('CAPTCHA Tokens (AES-GCM Encryption/Decryption)', () => {
    const nonce = 'captcha-test-nonce-123';

    it('verifies successfully with correct answer and nonce', async () => {
      const token = await createCaptchaToken(7, nonce);
      expect(token).toBeTypeOf('string');
      expect(token.split(':').length).toBe(2); // IV and ciphertext

      const isValid = await verifyCaptchaToken(token, 7, nonce);
      expect(isValid).toBe(true);
    });

    it('fails verification with incorrect answer', async () => {
      const token = await createCaptchaToken(7, nonce);
      const isValid = await verifyCaptchaToken(token, 8, nonce);
      expect(isValid).toBe(false);
    });

    it('fails verification with mismatched nonce', async () => {
      const token = await createCaptchaToken(7, nonce);
      const isValid = await verifyCaptchaToken(token, 7, 'different-nonce');
      expect(isValid).toBe(false);
    });

    it('fails verification for tampered captcha tokens', async () => {
      const token = await createCaptchaToken(7, nonce);
      const tampered = token.replace(/a/g, 'b');
      const isValid = await verifyCaptchaToken(tampered, 7, nonce);
      expect(isValid).toBe(false);
    });

    it('fails verification for empty or malformed token strings', async () => {
      expect(await verifyCaptchaToken('', 7, nonce)).toBe(false);
      expect(await verifyCaptchaToken('invalid-format', 7, nonce)).toBe(false);
    });
  });
});
