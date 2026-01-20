import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class LinkedinService implements OnModuleDestroy {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private readonly logger = new Logger(LinkedinService.name);

	constructor(private cryptoService: CryptoService) { }

	async onModuleDestroy() {
		await this.closeBrowser();
	}

	async launchBrowser() {
		if (this.browser) return;

		this.logger.log('Launching browser...');

		// Use local Chrome if specified (fixes local dlopen errors)
		const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;

		// Persistent session data
		const userDataDir = process.env.BROWSER_DATA_DIR || './browser-data';

		this.browser = await puppeteer.launch({
			headless: false, // Per rules: visible window is less suspicious
			userDataDir: userDataDir, // Persist cookies/localStorage/cache
			executablePath: executablePath,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-infobars',
				'--window-position=0,0',
				'--ignore-certifcate-errors',
				'--ignore-certifcate-errors-spki-list',
				'--disable-blink-features=AutomationControlled' // Anti-detection
			],
			defaultViewport: null,
			ignoreDefaultArgs: ['--enable-automation'],
		});

		this.page = await this.browser.newPage();

		// Set a realistic User Agent (could rotate in future)
		await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

		// Set extra headers
		await this.page.setExtraHTTPHeaders({
			'Accept-Language': 'en-US,en;q=0.9',
		});
	}

	async login(username: string, encryptedPassword: string): Promise<{ status: 'SUCCESS' | '2FA_REQUIRED' | 'FAILED' }> {
		if (!this.browser) {
			await this.launchBrowser();
		}

		try {
			const password = this.cryptoService.decrypt(encryptedPassword);

			this.logger.log(`Navigating to LinkedIn login for ${username}...`);
			await this.page!.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

			await this.randomDelay(1000, 3000);

			// Type username
			await this.page!.type('#username', username, { delay: 100 });
			await this.randomDelay(500, 1500);

			// Type password
			await this.page!.type('#password', password, { delay: 100 });
			await this.randomDelay(800, 2000);

			// Click login
			await Promise.all([
				this.page!.click('.btn__primary--large'),
				this.page!.waitForNavigation({ waitUntil: 'networkidle2' }),
			]);

			// Check for success (feed or 2FA)
			if (this.page!.url().includes('feed')) {
				this.logger.log('Login successful');
				return { status: 'SUCCESS' };
			} else if (this.page!.url().includes('checkpoint') || this.page!.url().includes('challenge')) {
				this.logger.warn('Login required 2FA / Verification. Waiting for code...');
				return { status: '2FA_REQUIRED' };
			}

			return { status: 'FAILED' };
		} catch (error) {
			this.logger.error('Login failed', error.stack);
			return { status: 'FAILED' };
		}
	}

	async submitTwoFactorCode(code: string): Promise<boolean> {
		if (!this.page) {
			this.logger.error('Browser not active. Cannot submit 2FA.');
			return false;
		}

		try {
			this.logger.log(`Submitting 2FA code: ${code}`);
			// Selectors vary, usually it's an input with ID 'input__phone_verification_pin' or similar
			// We will try a few common ones or generic input type=text/tel

			await this.page.type('input[name="pin"]', code, { delay: 100 });
			await this.randomDelay(500, 1000);

			await Promise.all([
				this.page.click('#two-step-submit-button'), // Hypothethical ID, often it's a submit btn
				this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
			]);

			if (this.page.url().includes('feed')) {
				this.logger.log('2FA Successful. Logged in.');
				return true;
			}

			return false;
		} catch (error) {
			this.logger.error('Failed to submit 2FA code', error.stack);
			return false;
		}
	}

	async scrapeMessages(): Promise<any[]> {
		if (!this.page) {
			this.logger.error('Browser not initialized or page closed');
			return [];
		}

		try {
			this.logger.log('Navigating to Messaging...');
			await this.page.goto('https://www.linkedin.com/messaging', { waitUntil: 'networkidle2' });

			await this.randomDelay(2000, 4000);

			// Basic selector check (might change, standard LinkedIn class)
			// This is a placeholder for the actual complex scraping logic
			const conversationCount = await this.page.evaluate(() => {
				const items = document.querySelectorAll('.msg-conversation-listitem');
				return items.length;
			});

			this.logger.log(`Found ${conversationCount} conversations (Placeholder logic)`);

			return [];
		} catch (error) {
			this.logger.error('Scraping messages failed', error.stack);
			return [];
		}
	}

	async closeBrowser() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
		}
	}

	private async randomDelay(min: number, max: number) {
		const delay = Math.floor(Math.random() * (max - min + 1)) + min;
		return new Promise(resolve => setTimeout(resolve, delay));
	}
}
