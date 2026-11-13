import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FieldEncryptionService {
  private readonly encryptionKey: Buffer;
  private readonly lookupKey: Buffer;

  constructor(config: ConfigService) {
    this.encryptionKey = this.readKey(config.getOrThrow('FIELD_ENCRYPTION_KEY'));
    this.lookupKey = this.readKey(config.getOrThrow('PII_LOOKUP_HMAC_KEY'));
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(value: string): string {
    const [version, iv, tag, ciphertext] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Unsupported encrypted value');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  lookup(value: string): string {
    return createHmac('sha256', this.lookupKey).update(value).digest('hex');
  }

  private readKey(value: string): Buffer {
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32) throw new Error('Encryption keys must decode to exactly 32 bytes');
    return key;
  }
}