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

	// TEMPORARY SAFETY RULES
	private readonly DRY_RUN_MODE = true; // Set to false to actually send messages
	private readonly MAX_UNREAD_LIMIT = 1; // Set to 20 when confident

	constructor(
		private prisma: PrismaService,
		private linkedinService: LinkedinService,
		private llmService: LlmService,
		private cryptoService: CryptoService,
		private notificationsGateway: NotificationsGateway,
	) { }

	// @Cron(CronExpression.EVERY_10_MINUTES)
	async handleCron() {
		this.logger.log('Starting Workflow (CRON) - DISABLED FOR SAFETY.');
		// await this.runWorkflow('CRON');
	}

	async runWorkflow(triggerSource: string = 'MANUAL') {
		if (this.isProcessing) {
			this.logger.warn(`Workflow already running. Skipping ${triggerSource} trigger.`);
			return;
		}

		this.isProcessing = true;
		this.notificationsGateway.emitWorkflowUpdate('GLOBAL', 'running', `Workflow started by ${triggerSource}`);

		try {
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
			// 1. Decrypt & Login
			const username = this.cryptoService.decrypt(account.emailEncrypted);
			const loginResult = await this.linkedinService.login(username, account.passwordEncrypted);

			if (loginResult.status !== 'SUCCESS') {
				this.logger.warn(`Login failed or required 2FA for tenant ${account.tenantId}. Status: ${loginResult.status}`);
				return;
			}

			// 2. Context Logic (Simplified)
			let contextSynthesis = account.contextSynthesis;
			if (!contextSynthesis) {
				// Try to get from DB first
				const cachedConversations = await this.prisma.conversation.findMany({
					where: { tenantId: account.tenantId, lastScrapedAt: { not: null } },
					take: 50,
					orderBy: { lastMessageAt: 'desc' },
					include: { contact: true }
				});

				let recentConvos: any[] = [];

				if (cachedConversations.length >= 10) {
					recentConvos = cachedConversations.map(c => ({
						conversationId: c.id,
						partnerName: c.contact?.fullName || 'Unknown',
						messages: (c.messages as any[]) || []
					}));
				} else {
					// Scrape if needed (Context scrape) - explicitly 20 for initialization as requested
					this.logger.log(`Context synthesis missing. Scraping last 20 recent conversations for initialization...`);
					recentConvos = await this.linkedinService.scrapeRecentConversations(20);

					// PERSISTENCE: Save scraped data immediately
					if (recentConvos.length > 0) {
						this.logger.log(`Persisting ${recentConvos.length} context conversations to DB...`);
						for (const conv of recentConvos) {
							try {
								// Upsert Contact
								let contact = await this.prisma.contact.findFirst({
									where: { tenantId: account.tenantId, fullName: conv.partnerName }
								});

								if (!contact) {
									contact = await this.prisma.contact.create({
										data: {
											tenantId: account.tenantId,
											fullName: conv.partnerName,
											linkedinProfileUrl: `https://linkedin.com/in/placeholder-${Date.now()}-${Math.random()}`,
											source: 'scraped_context'
										}
									});
								}

								// Upsert Conversation
								const existingConv = await this.prisma.conversation.findFirst({
									where: { contactId: contact.id }
								});

								if (existingConv) {
									await this.prisma.conversation.update({
										where: { id: existingConv.id },
										data: {
											messages: conv.messages,
											lastScrapedAt: new Date(),
											threadUrl: conv.threadUrl // Save thread URL
										}
									});
								} else {
									await this.prisma.conversation.create({
										data: {
											tenantId: account.tenantId,
											contactId: contact.id,
											messages: conv.messages,
											lastScrapedAt: new Date(),
											unreadCount: 0,
											threadUrl: conv.threadUrl // Save thread URL
										}
									});
								}
							} catch (e) {
								this.logger.warn(`Failed to save context conversation for ${conv.partnerName}: ${e.message}`);
							}
						}
					}
				}

				if (recentConvos.length > 0) {
					contextSynthesis = await this.llmService.generateContextSynthesis(account.tenantId, recentConvos);
					await this.prisma.linkedinAccount.update({
						where: { id: account.id },
						data: { contextSynthesis }
					});
				}
			}

			if (!contextSynthesis) {
				this.logger.error(`Context missing for account ${account.id}. Aborting.`);
				return;
			}

			// =========================================================
			// PHASE 1: SCRAPE & PERSIST (Status: PENDING_LLM)
			// =========================================================
			this.logger.log('--- PHASE 1: SCRAPE & PERSIST ---');
			const scrapedBatches = await this.linkedinService.scrapeMessages(this.MAX_UNREAD_LIMIT);

			for (const batch of scrapedBatches) {
				// Upsert Contact
				// Use partnerName as key for now (Simple MVP)
				let contact = await this.prisma.contact.findFirst({
					where: { tenantId: account.tenantId, fullName: batch.partnerName }
				});

				if (!contact) {
					contact = await this.prisma.contact.create({
						data: {
							tenantId: account.tenantId,
							fullName: batch.partnerName,
							linkedinProfileUrl: `https://linkedin.com/in/placeholder-${Date.now()}`, // Placeholder
							source: 'scraped_inbound'
						}
					});
				}

				// Upsert Conversation
				const conversation = await this.prisma.conversation.findFirst({
					where: { contactId: contact.id }
				});

				if (conversation) {
					await this.prisma.conversation.update({
						where: { id: conversation.id },
						data: {
							messages: batch.history.concat(batch.unreadMessages), // Update full history
							unreadCount: batch.unreadMessages.length,
							lastMessageAt: new Date(),
							lastScrapedAt: new Date(),
							threadUrl: batch.threadUrl,
							processingStatus: 'PENDING_LLM' // Mark for processing
						}
					});
				} else {
					await this.prisma.conversation.create({
						data: {
							tenantId: account.tenantId,
							contactId: contact.id,
							messages: batch.history.concat(batch.unreadMessages),
							unreadCount: batch.unreadMessages.length,
							lastMessageAt: new Date(),
							lastScrapedAt: new Date(),
							threadUrl: batch.threadUrl,
							processingStatus: 'PENDING_LLM'
						}
					});
				}
				this.logger.log(`Persisted URL ${batch.threadUrl} with status PENDING_LLM`);
			}

			// =========================================================
			// PHASE 2: GENERATE DRAFTS (Status: PENDING_LLM -> PENDING_REPLY)
			// =========================================================
			this.logger.log('--- PHASE 2: GENERATE DRAFTS ---');
			const pendingLlmConversations = await this.prisma.conversation.findMany({
				where: { tenantId: account.tenantId, processingStatus: 'PENDING_LLM' }
			});

			for (const conv of pendingLlmConversations) {
				const messages = conv.messages as any[]; // Assuming array of strings
				// Extract unread (last N) and history logic is approximate here since we merged them.
				// For simplicity, let's treat the last message as the trigger or use unreadCount.
				const unreadCount = conv.unreadCount || 1;
				const unreadMessages = messages.slice(-unreadCount);
				const history = messages.slice(0, -unreadCount);

				const response = await this.llmService.generateResponse(
					account.tenantId,
					unreadMessages,
					contextSynthesis,
					history
				);

				// Create Action
				await this.prisma.llmAction.create({
					data: {
						tenantId: account.tenantId,
						conversationId: conv.id,
						actionType: 'REPLY_SUGGESTION',
						confidenceScore: response.confidence_score,
						llmResponse: JSON.parse(JSON.stringify(response)),
						finalMessage: response.suggested_response,
						prompt: unreadMessages.join('\n'),
						metadata: {
							status: 'DRAFT',
							dry_run: this.DRY_RUN_MODE
						}
					}
				});

				// Update Status
				await this.prisma.conversation.update({
					where: { id: conv.id },
					data: { processingStatus: 'PENDING_REPLY' }
				});
				this.logger.log(`Generated draft for ${conv.id}, Status -> PENDING_REPLY`);
			}

			// =========================================================
			// PHASE 3: SEND REPLIES (Status: PENDING_REPLY -> COMPLETED)
			// =========================================================
			this.logger.log('--- PHASE 3: SEND REPLIES ---');
			const pendingReplyConversations = await this.prisma.conversation.findMany({
				where: { tenantId: account.tenantId, processingStatus: 'PENDING_REPLY' }
			});

			for (const conv of pendingReplyConversations) {
				if (!conv.threadUrl) {
					this.logger.warn(`Skipping conversation ${conv.id} - No Thread URL.`);
					continue;
				}

				// Fetch Draft
				const lastAction = await this.prisma.llmAction.findFirst({
					where: { conversationId: conv.id, actionType: 'REPLY_SUGGESTION' },
					orderBy: { createdAt: 'desc' }
				});

				if (!lastAction || !lastAction.finalMessage) {
					this.logger.warn(`No draft found for ${conv.id}`);
					continue;
				}

				this.logger.log(`Processing Reply for ${conv.id} (Dry Run: ${this.DRY_RUN_MODE})`);

				const success = await this.linkedinService.replyToConversation(
					conv.threadUrl,
					lastAction.finalMessage,
					this.DRY_RUN_MODE
				);

				if (success) {
					await this.prisma.conversation.update({
						where: { id: conv.id },
						data: {
							processingStatus: 'IDLE', // Back into pool
							unreadCount: 0
						}
					});

					// Verify/Log success action
					await this.prisma.llmAction.create({
						data: {
							tenantId: account.tenantId,
							conversationId: conv.id,
							actionType: 'REPLY_SENT',
							finalMessage: lastAction.finalMessage,
							metadata: {
								sent_at: new Date(),
								dry_run: this.DRY_RUN_MODE
							}
						}
					});
				}
			}

		} catch (e) {
			this.logger.error(`Error processing account ${account.id}`, e.stack);
		}
	}

	// Helper for saveScrapedConversations is now integrated/deprecated or can be removed if unused.
	// For now, I'll leave it removed as per replacement.
}
