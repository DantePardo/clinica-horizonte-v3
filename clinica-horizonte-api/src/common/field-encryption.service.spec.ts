import { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  const service = new FieldEncryptionService(new ConfigService({
    FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    PII_LOOKUP_HMAC_KEY: Buffer.alloc(32, 9).toString('base64'),
  }));

  it('encrypts and restores values without storing plaintext', () => {
    const value = '12345678-9';
    const encrypted = service.encrypt(value);

    expect(encrypted).not.toContain(value);
    expect(service.decrypt(encrypted)).toBe(value);
  });

  it('uses a fresh nonce and a stable keyed lookup digest', () => {
    const first = service.encrypt('patient data');
    const second = service.encrypt('patient data');

    expect(first).not.toBe(second);
    expect(service.lookup('12345678-9')).toBe(service.lookup('12345678-9'));
    expect(service.lookup('12345678-9')).not.toBe(service.lookup('98765432-1'));
  });

  it('rejects tampered ciphertext', () => {
    const [version, iv, tag, ciphertext] = service.encrypt('clinical note').split('.');
    const changedTag = `${tag[0] === 'A' ? 'B' : 'A'}${tag.slice(1)}`;
    const tampered = `${version}.${iv}.${changedTag}.${ciphertext}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });
});