/**
 * encryption.ts
 * AES-256-GCM encryption for sensitive fields (salary data)
 */

import crypto from 'crypto';
import { EncryptedData } from '../types/index';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // bytes for AES-256

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Derive 32-byte key from the env variable
  return crypto.createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  const result: EncryptedData = {
    iv: iv.toString('base64'),
    data: encrypted + '.' + authTag.toString('base64'),
  };

  return Buffer.from(JSON.stringify(result)).toString('base64');
}

export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey();

  const result: EncryptedData = JSON.parse(
    Buffer.from(encryptedBase64, 'base64').toString('utf8')
  );

  const iv = Buffer.from(result.iv, 'base64');
  const [encryptedData, authTagBase64] = result.data.split('.');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function encryptNumber(value: number): string {
  return encrypt(value.toString());
}

export function decryptNumber(encrypted: string): number {
  return parseFloat(decrypt(encrypted));
}
