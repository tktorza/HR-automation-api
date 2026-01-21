import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LinkedinService } from '../linkedin/linkedin.service';
import { LlmService } from '../llm/llm.service';
import { CryptoService } from '../crypto/crypto.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class OrchestratorService {
	private readonly logger = new Logger(OrchestratorService.name);
	private isProcessing = false;

	constructor(
		private prisma: PrismaService,
		private linkedinService: LinkedinService,
		private llmService: LlmService,
		private cryptoService: CryptoService,
		private notificationsGateway: NotificationsGateway,
	) { }

	@Cron(CronExpression.EVERY_10_MINUTES)
	async handleCron() {
		this.logger.log('Starting Workflow (CRON)...');
		await this.runWorkflow('CRON');
	}

	async runWorkflow(triggerSource: string = 'MANUAL') {
		if (this.isProcessing) {
			this.logger.warn(`Workflow already running. Skipping ${triggerSource} trigger.`);
			return;
		}

		this.isProcessing = true;
		this.notificationsGateway.emitWorkflowUpdate('GLOBAL', 'running', `Workflow started by ${triggerSource}`);

		try {
			// 1. Get Accounts
			const accounts = await this.prisma.linkedinAccount.findMany({
				where: { isActive: true },
			});

			this.logger.log(`Found ${accounts.length} active LinkedIn accounts.`);

			for (const account of accounts) {
				await this.processAccount(account);
			}

			this.notificationsGateway.emitWorkflowUpdate('GLOBAL', 'completed', `Workflow finished successfully`);
		} catch (error) {
			this.logger.error('Workflow failed', error);
			this.notificationsGateway.emitWorkflowUpdate('GLOBAL', 'failed', error.message);
		} finally {
			this.logger.log('Workflow finished.');
			this.isProcessing = false;
		}
	}

	private async processAccount(account: any) {
		this.logger.log(`Processing account for tenant ${account.tenantId}...`);

		try {
			// 1. Decrypt Credentials
			// account.emailEncrypted is actually the username/email we need to decrypt
			const username = this.cryptoService.decrypt(account.emailEncrypted);

			// 2. Login
			// We pass the encrypted password directly because LinkedinService.login expects encryptedPassword
			const loginResult = await this.linkedinService.login(username, account.passwordEncrypted);

			if (loginResult.status !== 'SUCCESS') {
				this.logger.warn(`Login failed or required 2FA for tenant ${account.tenantId}. Status: ${loginResult.status}`);
				// TODO: Create a Notification via NotificationService here if 2FA is required
				return;
			}

			// 3. Scrape
			// For V1 scraping is a placeholder returning empty array or mock
			const messages = await this.linkedinService.scrapeMessages();
			this.logger.log(`Scraped ${messages.length} new messages.`);

			// 4. Process each message
			for (const msg of messages) {
				// Check if conversation exists or create it
				// This logic depends on what scrapeMessages returns. 
				// Assuming it returns objects with { text, senderUrn, conversationUrn, etc. }

				// Generate LLM Response
				const response = await this.llmService.generateResponse(account.tenantId, msg.text);

				// Save Action
				// We need a conversationId. For now, let's assume valid conversationId or create a placeholder.
				// Since we don't have real messages, we can't really INSERT into DB without violating FKs if convo doesn't exist.
				// So for V1 we just LOG the result if we can't save.

				/* 
				await this.prisma.llmAction.create({
					data: {
						tenantId: account.tenantId,
						conversationId: '...', // derived from msg
						actionType: 'REPLY_SUGGESTION',
						confidenceScore: response.confidence_score,
						llmResponse: response,
						prompt: msg.text,
						finalMessage: response.suggested_response
					}
				});
				*/
				this.logger.log(`Generated response for msg: ${JSON.stringify(response)}`);
			}
		} catch (e) {
			this.logger.error(`Error processing account ${account.id}`, e.stack);
		}
	}
}
