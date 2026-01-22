import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LinkedinService implements OnModuleDestroy {
	private browser: Browser | null = null;
	private page: Page | null = null;
	private readonly logger = new Logger(LinkedinService.name);

	constructor(
		private cryptoService: CryptoService,
		private prisma: PrismaService,
	) { }

	async onModuleDestroy() {
		await this.closeBrowser();
	}

	async getAccountsForTenant(tenantId: string) {
		const accounts = await this.prisma.linkedinAccount.findMany({
			where: { tenantId },
			select: {
				id: true,
				emailEncrypted: true,
				isActive: true,
				lastScrapeAt: true,
			}
		});

		return accounts.map(acc => ({
			id: acc.id,
			email: this.cryptoService.decrypt(acc.emailEncrypted),
			isActive: acc.isActive,
			lastScrapeAt: acc.lastScrapeAt
		}));
	}

	async addAccount(tenantId: string, email: string, password: string) {
		// 1. Check for duplicates
		const existingAccounts = await this.prisma.linkedinAccount.findMany({
			where: { tenantId }
		});

		for (const acc of existingAccounts) {
			try {
				const decryptedEmail = this.cryptoService.decrypt(acc.emailEncrypted);
				if (decryptedEmail.toLowerCase() === email.toLowerCase()) {
					throw new Error('DUPLICATE_ACCOUNT');
				}
			} catch (e) {
				// Ignore decryption errors on other accounts, just continue
				if (e.message === 'DUPLICATE_ACCOUNT') throw e;
				this.logger.warn(`Failed to decrypt email for account ${acc.id}`);
			}
		}

		// 2. Create new account
		const emailEncrypted = this.cryptoService.encrypt(email);
		const passwordEncrypted = this.cryptoService.encrypt(password);

		return this.prisma.linkedinAccount.create({
			data: {
				tenantId,
				emailEncrypted,
				passwordEncrypted,
				isActive: true,
			},
			select: {
				id: true,
				emailEncrypted: true,
				isActive: true,
				lastScrapeAt: true,
			}
		});
	}

	async launchBrowser() {
		if (this.browser) return;

		this.logger.log('Launching browser...');

		// Use local Chrome if specified (fixes local dlopen errors)
		const executablePath = process.env.CHROME_EXECUTABLE_PATH || undefined;

		// Persistent session data - make absolute to avoid confusion
		let userDataDir = process.env.BROWSER_DATA_DIR || require('path').resolve('./browser-data');

		const launchOptions: any = {
			headless: false,
			executablePath: executablePath,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-infobars',
				'--window-position=0,0',
				'--ignore-certificate-errors',
				'--ignore-certificate-errors-spki-list',
				'--disable-blink-features=AutomationControlled'
			],
			defaultViewport: null,
			ignoreDefaultArgs: ['--enable-automation'],
		};

		try {
			// Optimization: Try persistent dir first
			this.logger.log(`Attempting to launch with userDataDir: ${userDataDir}`);
			this.browser = await puppeteer.launch({
				...launchOptions,
				userDataDir: userDataDir
			});
		} catch (error) {
			this.logger.warn(`Failed to launch with persistent userDataDir: ${error.message}. Checking for existing session...`);

			// Fallback: Temporary session (Context won't be saved, but workflow runs)
			this.logger.warn('Falling back to TEMPORARY session. Context/Cookies will NOT be saved after this run.');
			this.browser = await puppeteer.launch({
				...launchOptions,
				// No userDataDir = temp dir
			});
		}

		// Fix: Reuse existing page to avoid opening multiple tabs
		const pages = await this.browser.pages();
		this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

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
		if (!this.page) return { status: 'FAILED' };

		try {
			this.logger.log(`Checking session status for ${username}...`);

			// 1. Check for existing session (Robust & Fast)
			// Use domcontentloaded: we just need the DOM to check for the avatar.
			// LinkedIn feed never truly goes "networkidle" due to tracking/streaming.
			try {
				await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
			} catch (e) {
				this.logger.debug(`Feed navigation minor timeout/error (continuing to check DOM): ${e.message}`);
			}

			// Give a small moment for dynamic elements (like the avatar) to render if they rely on JS
			await this.randomDelay(1000, 2000);

			this.logger.log(`Current URL after feed nav: ${this.page.url()}`);

			try {
				await this.page.waitForSelector('.global-nav__me-photo', { timeout: 5000 });
				this.logger.log('Session active. Verified by navbar avatar.');
				return { status: 'SUCCESS' };
			} catch {
				this.logger.log('No active session detected (avatar not found). Proceeding to login.');
			}

			// 2. Perform Login
			this.logger.log('Navigating to Login Page...');
			await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
			await this.randomDelay(1000, 2000);

			// Check inputs
			try {
				await this.page.waitForSelector('#username', { timeout: 5000 });
			} catch {
				this.logger.warn('Login inputs not found. checking context...');
				if (this.page.url().includes('feed') || await this.page.$('.global-nav__me-photo')) {
					return { status: 'SUCCESS' };
				}
				await this.page.screenshot({ path: 'debug-login-inputs-missing.png' });
				return { status: 'FAILED' };
			}

			const password = this.cryptoService.decrypt(encryptedPassword);

			this.logger.log('Typing credentials...');
			await this.page.type('#username', username, { delay: 100 });
			await this.randomDelay(500, 1000);
			await this.page.type('#password', password, { delay: 100 });
			await this.randomDelay(800, 1500);

			await Promise.all([
				this.page.click('.btn__primary--large'),
				this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
			]);

			// 3. Verify Login Success
			if (await this.page.$('#input__email_verification_pin') || this.page.url().includes('challenge')) {
				this.logger.warn('2FA Required');
				return { status: '2FA_REQUIRED' };
			}

			if (this.page.url().includes('feed') || await this.page.$('.global-nav__me-photo')) {
				this.logger.log('Login successful.');
				return { status: 'SUCCESS' };
			} else {
				this.logger.error('Login failed. Not on feed.');
				await this.page.screenshot({ path: 'debug-login-failed.png' });
				return { status: 'FAILED' };
			}

		} catch (error) {
			this.logger.error('Login process failed', error.stack);
			if (this.page) await this.page.screenshot({ path: 'debug-login-exception.png' });
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

	async scrapeRecentConversations(limit: number): Promise<any[]> {
		if (!this.page) return [];

		try {
			this.logger.log(`Scraping last ${limit} conversations for context...`);
			await this.page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 20000 });
			await this.randomDelay(2000, 4000);

			// 1. Get list of conversations
			// Use strict selector to avoid duplicates (removed .msg-conversation-card)
			const listSelector = '.msg-conversation-listitem';

			try {
				await this.page.waitForSelector(listSelector, { timeout: 10000 });
			} catch (e) {
				this.logger.warn(`Timeout waiting for selector "${listSelector}". Taking screenshot...`);
				if (this.page) await this.page.screenshot({ path: 'debug-scraping-conv-timeout.png' });
				return [];
			}

			const conversationsData: any[] = [];

			// Initial Count
			let conversationCount = await this.page.$$eval(listSelector, els => els.length);
			this.logger.log(`Initially found ${conversationCount} conversations.`);

			// Scroll if needed to meet limit
			if (conversationCount < limit) {
				this.logger.log(`Scrolling to load more conversations (target: ${limit})...`);
				await this.page.evaluate(async (target) => {
					const listItems = document.querySelectorAll('.msg-conversation-listitem');
					if (listItems.length > 0) {
						const container = listItems[0].closest('ul')?.parentElement || listItems[0].closest('.msg-conversations-container__conversations-list');
						if (container) {
							for (let i = 0; i < 5; i++) {
								container.scrollTop = container.scrollHeight;
								await new Promise(r => setTimeout(r, 1000));
							}
						}
					}
				}, limit);
				// Re-count
				await this.randomDelay(1000, 2000);
				conversationCount = await this.page.$$eval(listSelector, els => els.length);
				this.logger.log(`After scroll: found ${conversationCount} conversations.`);
			}

			const max = Math.min(limit, conversationCount);

			for (let i = 0; i < max; i++) {
				// Re-query list items each iteration to keep freshness
				const items = await this.page.$$(listSelector);
				if (!items[i]) continue;

				// Scroll item into view before clicking (prevent click interception)
				await items[i].evaluate(el => el.scrollIntoView({ block: 'center' }));
				await this.randomDelay(200, 500);

				try {
					await items[i].click();
				} catch (err) {
					this.logger.warn(`Could not click item ${i}, skipping...`);
					continue;
				}
				await this.randomDelay(1500, 3000);

				const threadUrl = this.page.url(); // Capture Thread URL for context conversations too

				// Extract Content
				const history = await this.page.evaluate(() => {
					// Select only message bodies (avoid container)
					const elements = Array.from(document.querySelectorAll('.msg-s-event-listitem'));

					return elements.map(el => {
						const body = el.querySelector('.msg-s-event-listitem__body');
						let text = body?.textContent || '';

						text = text
							.replace(/[\n\r]+/g, ' ')
							.replace(/\s+/g, ' ')
							.replace('Open emoji keyboard', '')
							.replace('Voir la traduction', '')
							.trim();

						if (!text) return null;

						const isMine = !el.classList.contains('msg-s-event-listitem--other');
						const sender = isMine ? 'user' : 'contact'; // Standardized values

						// Attempt to get time
						const timeEl = el.querySelector('time');
						const createdAt = timeEl ? timeEl.getAttribute('datetime') || new Date().toISOString() : new Date().toISOString();

						return { text, sender, createdAt, metadata: { isLlmGenerated: false } };
					}).filter(msg => msg !== null);
				});

				const partnerName = await this.page.evaluate(() => {
					// Try to find the header title
					const header = document.querySelector('.msg-entity-lockup__entity-title');
					if (header) return header.textContent?.trim();
					return 'Unknown';
				}) || 'Unknown';

				conversationsData.push({
					conversationId: `conv-${i}`,
					partnerName,
					threadUrl, // Add to result
					messages: history
				});
			}

			return conversationsData;
		} catch (error) {
			this.logger.error('Scraping recent conversations failed', error.stack);
			if (this.page) await this.page.screenshot({ path: 'debug-scraping-conv-error.png' });
			return [];
		}
	}

	async scrapeMessages(limit: number = 20): Promise<any[]> {
		if (!this.page) return [];

		try {
			this.logger.log(`Navigating to Messaging to check unread (Limit: ${limit})...`);
			await this.page.goto('https://www.linkedin.com/messaging/?filter=unread', { waitUntil: 'domcontentloaded', timeout: 20000 });
			await this.randomDelay(2000, 4000);

			const listSelector = '.msg-conversation-listitem, .msg-conversation-card';
			try {
				await this.page.waitForSelector(listSelector, { timeout: 10000 });
			} catch (e) {
				this.logger.warn(`Timeout waiting for selector "${listSelector}". Taking screenshot...`);
				if (this.page) await this.page.screenshot({ path: 'debug-scraping-msgs-timeout.png' });
				return [];
			}

			// Find unread indices
			const unreadIndices = await this.page.evaluate(() => {
				const items = Array.from(document.querySelectorAll('.msg-conversation-listitem, .msg-conversation-card'));
				return items.map((item, index) => {
					// Check for badged elements usually indicating unread
					const badge = item.querySelector('.notification-badge--show, .msg-conversation-card__unread-count');
					return badge ? index : -1;
				}).filter(i => i !== -1);
			});

			this.logger.log(`Found ${unreadIndices.length} unread conversations.`);

			if (unreadIndices.length === 0) {
				await this.page.screenshot({ path: 'debug-scraping-msgs-0-unread.png' });
				return [];
			}

			// Apply Limit
			const indicesToProcess = unreadIndices.slice(0, limit);
			this.logger.log(`Processing ${indicesToProcess.length} conversations (User Limit: ${limit}).`);

			const results: any[] = [];

			for (const index of indicesToProcess) {
				// Re-fetch items to avoid stale elements
				const items = await this.page.$$(listSelector);
				if (!items[index]) continue;

				await items[index].click();
				await this.randomDelay(2000, 4000);

				const threadUrl = this.page.url(); // Capture URL

				// Scrape messages with metadata
				const fullHistory = await this.page.evaluate(() => {
					// Use specific message items
					const elements = Array.from(document.querySelectorAll('.msg-s-event-listitem'));

					return elements.map(el => {
						const body = el.querySelector('.msg-s-event-listitem__body');
						let text = body?.textContent || '';

						text = text
							.replace(/[\n\r]+/g, ' ')
							.replace(/\s+/g, ' ')
							.replace('Open emoji keyboard', '')
							.replace('Voir la traduction', '')
							.trim();

						if (!text) return null;

						// Determine sender
						const isMine = !el.classList.contains('msg-s-event-listitem--other');
						const sender = isMine ? 'user' : 'contact';

						// Attempt to get time (often in a time element or aria-label)
						// LinkedIn structure varies, often <time class="msg-s-message-group__timestamp">
						const timeEl = el.querySelector('time');
						const createdAt = timeEl ? timeEl.getAttribute('datetime') || new Date().toISOString() : new Date().toISOString();

						return {
							text,
							sender,
							createdAt,
							metadata: { isLlmGenerated: false }
						};
					}).filter(t => t !== null);
				});

				const partnerName = await this.page.evaluate(() => {
					const header = document.querySelector('.msg-entity-lockup__entity-title');
					return header ? header.textContent?.trim() : 'Unknown';
				}) || 'Unknown';

				const unreadMessages = fullHistory.slice(-5); // Increase context slightly to 5? User said 20 msgs in logic, probably meaning 20 Convs. Keep 3-5.
				const history = fullHistory.slice(0, -5);

				results.push({
					conversationId: `conv-unread-${index}`, // Temporary ID, we will try to match by URL/Name later
					partnerName,
					threadUrl,
					unreadMessages,
					history
				});
			}

			return results;

		} catch (error) {
			this.logger.error('Scraping messages failed', error.stack);
			if (this.page) await this.page.screenshot({ path: 'debug-scraping-msgs-error.png' });
			return [];
		}
	}
	async replyToConversation(threadUrl: string, message: string, dryRun: boolean = true): Promise<boolean> {
		if (!this.page) return false;

		try {
			this.logger.log(`Navigating to conversation URL: ${threadUrl}`);
			await this.page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
			await this.randomDelay(2000, 4000);

			// Check if we are in the conversation (message input exists)
			const inputSelector = '.msg-form__contenteditable'; // Common selector for LinkedIn messages
			try {
				await this.page.waitForSelector(inputSelector, { timeout: 10000 });
			} catch (e) {
				this.logger.warn(`Message input not found for ${threadUrl}. Might not be connected or UI changed.`);
				return false;
			}

			// Type message (Simulate human typing)
			this.logger.log('Typing response...');
			await this.page.click(inputSelector);
			await this.page.type(inputSelector, message, { delay: 100 });
			await this.randomDelay(1000, 2000);

			if (dryRun) {
				this.logger.log(`[DRY RUN] Would have sent message: "${message}"`);
				this.logger.log('[DRY RUN] Skipping click send.');
				return true;
			}

			// Click Send
			this.logger.log('Clicking send...');
			// Usually there is a send button, sometimes hidden until typing.
			const sendSelector = '.msg-form__send-button';
			await this.page.waitForSelector(sendSelector, { visible: true, timeout: 5000 });
			await this.page.click(sendSelector);
			await this.randomDelay(2000, 3000);

			// Verify if sent (message appears in list) - optional Check
			this.logger.log('Message sent successfully.');
			return true;

		} catch (error) {
			this.logger.error(`Failed to reply to conversation ${threadUrl}`, error);
			return false;
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
