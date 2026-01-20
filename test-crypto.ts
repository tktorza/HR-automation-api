import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './src/crypto/crypto.service';

async function bootstrap() {
	process.env.ENCRYPTION_KEY = 'c51ce0b8e5a9874fa1479f30cb925643a04b42b87622669bd587642710ad4fa1';

	const app = await Test.createTestingModule({
		providers: [CryptoService],
	}).compile();

	const cryptoService = app.get<CryptoService>(CryptoService);
	cryptoService.onModuleInit();

	const text = 'SuperSecretLinkedInPassword123';
	const encrypted = cryptoService.encrypt(text);
	console.log('Encrypted:', encrypted);

	const decrypted = cryptoService.decrypt(encrypted);
	console.log('Decrypted:', decrypted);

	if (text === decrypted) {
		console.log('SUCCESS: Encryption/Decryption works.');
	} else {
		console.error('FAILURE: Decrypted text does not match.');
		process.exit(1);
	}
}
bootstrap();
