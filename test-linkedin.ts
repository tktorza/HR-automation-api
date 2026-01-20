import { Test } from '@nestjs/testing';
import { LinkedinService } from './src/linkedin/linkedin.service';
import { CryptoModule } from './src/crypto/crypto.module';
import { CryptoService } from './src/crypto/crypto.service';

async function bootstrap() {
	// Set env vars
	process.env.ENCRYPTION_KEY = 'c51ce0b8e5a9874fa1479f30cb925643a04b42b87622669bd587642710ad4fa1';
	process.env.CHROME_EXECUTABLE_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

	console.log('Using Chrome at:', process.env.CHROME_EXECUTABLE_PATH);

	const moduleRef = await Test.createTestingModule({
		imports: [CryptoModule],
		providers: [LinkedinService, CryptoService],
	}).compile();

	const linkedinService = moduleRef.get<LinkedinService>(LinkedinService);
	const cryptoService = moduleRef.get<CryptoService>(CryptoService);

	// Init manual dependencies
	cryptoService.onModuleInit();

	try {
		console.log('Testing Browser Launch...');
		await linkedinService.launchBrowser();
		console.log('Browser Launched. Waiting 5s...');

		await new Promise(r => setTimeout(r, 5000));

		console.log('Closing...');
		await linkedinService.closeBrowser();
		console.log('Success.');
	} catch (e) {
		console.error('Error:', e);
	}
}
bootstrap();
