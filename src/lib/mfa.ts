import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { env } from './env';

const ALGORITHM = 'aes-256-gcm';

// Derive encryption key lazily (not at module evaluation time)
let _encryptionKey: Buffer | null = null;
function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    const secret = env.MFA_ENCRYPTION_SECRET || env.JWT_SECRET;
    if (!secret) {
      throw new Error('MFA_ENCRYPTION_SECRET or JWT_SECRET is required for MFA encryption');
    }
    if (!env.MFA_ENCRYPTION_SECRET) {
      console.warn('⚠️ Warning: MFA_ENCRYPTION_SECRET is not set. Falling back to JWT_SECRET for MFA encryption. It is highly recommended to isolate these keys in production.');
    }
    _encryptionKey = crypto.scryptSync(secret, 'primetek-mfa-salt', 32);
  }
  return _encryptionKey;
}

export function encryptSecret(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // Legacy unencrypted secret fallback
      return encryptedData;
    }
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText!, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt MFA secret, attempting raw fallback:', err);
    return encryptedData;
  }
}

export function generateMFASecret(email: string) {
  const secret = generateSecret();
  const otpauth = generateURI({
    secret,
    label: email,
    issuer: 'Primetek Global',
  });
  return { secret, otpauth };
}

export async function generateQRCode(otpauth: string) {
  try {
    return await QRCode.toDataURL(otpauth);
  } catch (err) {
    console.error('QR Code generation error:', err);
    throw new Error('Failed to generate QR code');
  }
}

export async function verifyMFAToken(token: string, secret: string): Promise<boolean> {
  const result = await verify({ token, secret });
  return typeof result === 'boolean' ? result : !!(result && result.valid);
}
