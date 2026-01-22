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
			// =========================================================
			// PHASE 1: SCRAPE & PERSIST (Status: PENDING_LLM)
			// =========================================================
			this.logger.log('--- PHASE 1: SCRAPE & PERSIST (SYNC STRATEGY) ---');
			// Scrape returns FULL HISTORY now as 'messages'
			const scrapedBatches = await this.linkedinService.scrapeMessages(this.MAX_UNREAD_LIMIT);

			for (const batch of scrapedBatches) {
				// Upsert Contact
				let contact = await this.prisma.contact.findFirst({
					where: { tenantId: account.tenantId, fullName: batch.partnerName }
				});

				if (!contact) {
					contact = await this.prisma.contact.create({
						data: {
							tenantId: account.tenantId,
							fullName: batch.partnerName,
							linkedinProfileUrl: `https://linkedin.com/in/placeholder-${Date.now()}`,
							source: 'scraped_inbound'
						}
					});
				}

				// Fetch Existing Conversation
				const existingConv = await this.prisma.conversation.findFirst({
					where: { contactId: contact.id }
				});

				let finalMessages: any[] = [];
				let newUnreadMessages: any[] = [];
				// The Scraper returns 'messages' as full visible history
				const scrapedHistory = (batch.messages || []) as any[];

				if (existingConv) {
					// --- EXISTING CONVERSATION: SYNC/DIFF ---
					const dbMessages = (existingConv.messages as any[]) || [];

					if (dbMessages.length === 0) {
						// Fallback: If DB is empty for some reason, take full scrape
						newUnreadMessages = scrapedHistory;
						finalMessages = scrapedHistory;
					} else {
						// Find the last DB message in the scraped history to sync
						const lastDbMsg = dbMessages[dbMessages.length - 1];

						// Try to find matching index in scraped history (by content + sender + time approximation if needed)
						// Simple check: Exact content match of last message
						const matchIndex = scrapedHistory.findIndex(m =>
							m.text === lastDbMsg.text && m.sender === lastDbMsg.sender
						);

						if (matchIndex !== -1) {
							// We found the overlap point. 
							// New messages are everything AFTER this index.
							newUnreadMessages = scrapedHistory.slice(matchIndex + 1);

							// Reconstruct full history: DB History + New Parts
							// (We trust DB history more as it might be longer than what's visible on screen)
							finalMessages = [...dbMessages, ...newUnreadMessages];
						} else {
							// GAP or NO MATCH (e.g. older messages scrolled out of view, or slight diff)
							// Safety Fallback: Take the whole scraped history as authority if we can't sync?
							// OR: Just assume everything scraped that is "newer" is new?
							// Let's assume Scraper is 'Current State'. If we can't match, we might duplicate or lose.
							// Better Safety: If last DB message not found, maybe just append ALL scraped? No, duplicates.
							// Strategy: Use Scraped History as the new Source of truth if sync fails, but warn.
							this.logger.warn(`Could not sync DB history with Scraped history for ${batch.partnerName}. Using Scraped as new truth.`);
							finalMessages = scrapedHistory;
							// Unread is harder to define here. Let's assume all are "new context" but maybe not all unread.
							// Logic: If user replies, usually unread is after user reply.
							// Find last user message in the new set
							const lastUserIdx = finalMessages.map(m => m.sender).lastIndexOf('user');
							if (lastUserIdx !== -1) {
								newUnreadMessages = finalMessages.slice(lastUserIdx + 1);
							} else {
								newUnreadMessages = finalMessages;
							}
						}
					}

					if (newUnreadMessages.length === 0) {
						this.logger.log(`No new messages to sync for ${batch.partnerName}.`);
						continue;
					}

					// Update DB
					await this.prisma.conversation.update({
						where: { id: existingConv.id },
						data: {
							messages: finalMessages,
							unreadCount: newUnreadMessages.length,
							lastMessageAt: new Date(),
							lastScrapedAt: new Date(),
							threadUrl: batch.threadUrl,
							processingStatus: 'PENDING_LLM'
						}
					});

				} else {
					// --- NEW CONVERSATION (SCENARIO A) ---
					// User Rule: "If No DB History -> Get ALL messages from him and me"

					// Full Scraped IS the history
					finalMessages = scrapedHistory;
					newUnreadMessages = scrapedHistory; // Treat ALL as "Actionable/Unread" for Trigger purposes

					await this.prisma.conversation.create({
						data: {
							tenantId: account.tenantId,
							contactId: contact.id,
							messages: finalMessages,
							unreadCount: newUnreadMessages.length,
							lastMessageAt: new Date(),
							lastScrapedAt: new Date(),
							threadUrl: batch.threadUrl,
							processingStatus: 'PENDING_LLM'
						}
					});
				}
				this.logger.log(`Persisted ${batch.partnerName} (New: ${newUnreadMessages.length}). Status -> PENDING_LLM`);
			}

			// =========================================================
			// PHASE 2: GENERATE DRAFTS (Status: PENDING_LLM -> PENDING_REPLY)
			// =========================================================
			this.logger.log('--- PHASE 2: GENERATE DRAFTS ---');
			const pendingLlmConversations = await this.prisma.conversation.findMany({
				where: { tenantId: account.tenantId, processingStatus: 'PENDING_LLM' }
			});

			for (const conv of pendingLlmConversations) {
				const messages = conv.messages as any[];
				// Define what we send to LLM.

				// Context: The FULL history (messages)
				const history = messages;

				// Unread Block (Target to reply to):
				// We need to re-calculate "Unread" from the DB state or use `unreadCount` field we just saved.
				const unreadCount = conv.unreadCount || messages.length;
				const unreadMessages = messages.slice(-unreadCount);

				// Safety: If unreadMessages is empty (shouldn't be due to status), skip
				if (unreadMessages.length === 0) {
					this.logger.warn(`Skipping draft generation for ${conv.id} - 0 unread messages.`);
					await this.prisma.conversation.update({
						where: { id: conv.id },
						data: { processingStatus: 'IDLE', unreadCount: 0 }
					});
					continue;
				}

				this.logger.log(`Generating draft for ${conv.id}. Context: ${history.length} msgs, Target: ${unreadMessages.length} msgs.`);

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
						prompt: unreadMessages.map(m => `${m.sender}: ${m.text}`).join('\n'),
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

				// DEBUG LOGS requested by User
				const lastMessage = (conv.messages as any[]).slice(-1)[0];
				if (lastMessage) {
					this.logger.log(`[DEBUG] Replying to (Sender: ${lastMessage.sender}): "${lastMessage.text?.substring(0, 50)}..."`);
				}
				this.logger.log(`[DEBUG] Proposed Reply: "${lastAction.finalMessage}"`);

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
