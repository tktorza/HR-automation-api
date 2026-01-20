import { Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService implements OnModuleInit {
	private algorithm = 'aes-256-gcm';
	private key: Buffer;

	onModuleInit() {
		const keyString = process.env.ENCRYPTION_KEY;
		if (!keyString) {
			throw new Error('ENCRYPTION_KEY is not defined in .env');
		}
		if (keyString.length !== 64) {
			throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
		}
		this.key = Buffer.from(keyString, 'hex');
	}

	encrypt(text: string): string {
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

		let encrypted = cipher.update(text, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		const authTag = cipher.getAuthTag();

		// Return IV:AuthTag:EncryptedText
		return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
	}

	decrypt(text: string): string {
		const parts = text.split(':');
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted text format');
		}

		const [ivHex, authTagHex, encryptedHex] = parts;
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');
		const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;

		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	}
}
