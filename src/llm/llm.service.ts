import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_PROMPT } from './prompts';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

interface LLMResponse {
	action: 'reply' | 'ignore' | 'escalate';
	confidence_score: number;
	message?: string;
	reasoning: string;
	metadata?: any;
}

@Injectable()
export class LlmService implements OnModuleInit {
	private readonly logger = new Logger(LlmService.name);
	private claudeProvider: ClaudeProvider;

	// Global/Fallback Keys (env vars)
	private globalAnthropicKey: string;
	private globalGoogleKey: string;

	constructor(private prisma: PrismaService) { }

	onModuleInit() {
		this.globalAnthropicKey = process.env.ANTHROPIC_API_KEY || '';
		this.globalGoogleKey = process.env.GOOGLE_AI_API_KEY || '';

		if (this.globalAnthropicKey) {
			this.claudeProvider = new ClaudeProvider(this.globalAnthropicKey);
		}
	}

	async generateResponse(tenantId: string, userMessage: string, context?: any): Promise<LLMResponse> {
		await this.checkQuota(tenantId);

		// 1. Fetch Tenant Config (Keys & Preference)
		const tenantConfig = await this.prisma.onboardingConfig.findUnique({
			where: { tenantId },
		});

		const preference = tenantConfig?.llmProviderPreference || 'auto';
		const tenantGoogleKey = tenantConfig?.googleAiApiKey;
		// For now we use global Anthropic key, but could extend to tenant specific if needed.

		// Initialize Gemini Provider (Per request if key changes, or cache it - simplified new instance for now)
		let geminiProvider: GeminiProvider | null = null;
		if (tenantGoogleKey || this.globalGoogleKey) {
			geminiProvider = new GeminiProvider(tenantGoogleKey || this.globalGoogleKey);
		}

		// 2. Build Contextual System Prompt
		let system = SYSTEM_PROMPT;
		if (context && context.style) {
			system += `\n\nAdditional Style Instructions: ${JSON.stringify(context.style)}`;
		}

		// 3. Routing Logic
		let response: LLMResponse;
		let providerUsed = 'gemini';
		let inputTokens = 0;
		let outputTokens = 0;

		try {
			if (preference === 'claude-only' || !geminiProvider) {
				providerUsed = 'claude-sonnet';
				const result = await this.claudeProvider.generateResponse(system, userMessage, false); // false = Sonnet
				response = result.content;
				inputTokens = result.usage.input_tokens;
				outputTokens = result.usage.output_tokens;

			} else if (preference === 'gemini-only') {
				providerUsed = 'gemini';
				response = await geminiProvider.generateResponse(system, userMessage);
				inputTokens = geminiProvider.estimateTokens(system + userMessage);
				outputTokens = geminiProvider.estimateTokens(JSON.stringify(response));

			} else {
				// AUTO (Hybrid)
				// Tier 1: Gemini Flash
				try {
					providerUsed = 'gemini';
					response = await geminiProvider.generateResponse(system, userMessage);
					inputTokens = geminiProvider.estimateTokens(system + userMessage);
					outputTokens = geminiProvider.estimateTokens(JSON.stringify(response));

					// Check Escalation
					if (this.shouldUpgradeToHaiku(response, userMessage, context?.messages || [])) {
						this.logger.log(`Escalating to Claude Haiku for tenant ${tenantId}`);
						providerUsed = 'claude-haiku';
						const result = await this.claudeProvider.generateResponse(system, userMessage, true); // true = Haiku
						response = result.content;
						// Update tokens to reflect the Haiku usage (ignoring the previous Gemini cost or summing it? Usually sum both)
						// For accurate accounting, we should track both.
						await this.trackUsage(tenantId, 'gemini', inputTokens, outputTokens); // Track Gemini usage first

						inputTokens = result.usage.input_tokens;
						outputTokens = result.usage.output_tokens;
					}

				} catch (error) {
					this.logger.warn('Gemini failed, falling back to Claude', error);
					providerUsed = 'claude-haiku';
					const result = await this.claudeProvider.generateResponse(system, userMessage, true);
					response = result.content;
					inputTokens = result.usage.input_tokens;
					outputTokens = result.usage.output_tokens;
				}
			}

			// Add metadata about provider
			response.metadata = { ...response.metadata, provider: providerUsed };

			// Track usage for the final response (or the only response)
			await this.trackUsage(tenantId, providerUsed, inputTokens, outputTokens);

			return response;

		} catch (error) {
			this.logger.error('LLM Generation failed', error);
			throw error;
		}
	}

	private shouldUpgradeToHaiku(response: LLMResponse, message: string, history: any[]): boolean {
		const sensitiveKeywords = ['salaire', 'salary', 'refus', 'reject', 'litige', 'dispute', 'annuler', 'cancel'];
		const isNegative = response.metadata?.detected_sentiment === 'negative';
		const isComplex = history.length > 10;
		const isLowConfidence = (response.confidence_score || 0) < 75;

		const hasSensitiveKeyword = sensitiveKeywords.some(kw => message.toLowerCase().includes(kw));

		return isLowConfidence || hasSensitiveKeyword || isComplex || isNegative;
	}

	// Quota Management
	private async checkQuota(tenantId: string) {
		const currentMonth = new Date().toISOString().slice(0, 7);
		const quota = await this.prisma.llmQuota.findUnique({
			where: { tenantId_monthYear: { tenantId, monthYear: currentMonth } }
		});

		if (quota && quota.isLimitReached) {
			throw new ForbiddenException('Monthly LLM quota reached for this tenant.');
		}
	}

	private async trackUsage(tenantId: string, provider: string, inputTokens: number, outputTokens: number) {
		const currentMonth = new Date().toISOString().slice(0, 7);

		// Pricing (USD per 1M tokens)
		// Gemini 2.0 Flash: $0.075 / $0.30
		// Claude Haiku: $0.25 / $1.25
		// Claude Sonnet: $3.00 / $15.00

		let costInput = 0;
		let costOutput = 0;

		switch (provider) {
			case 'gemini':
				costInput = 0.075; costOutput = 0.30; break;
			case 'claude-haiku':
				costInput = 0.25; costOutput = 1.25; break;
			case 'claude-sonnet':
				costInput = 3.00; costOutput = 15.00; break;
			default:
				costInput = 3.00; costOutput = 15.00;
		}

		const cost = (inputTokens * costInput / 1_000_000) + (outputTokens * costOutput / 1_000_000);
		const totalTokens = inputTokens + outputTokens;

		await this.prisma.llmQuota.upsert({
			where: { tenantId_monthYear: { tenantId, monthYear: currentMonth } },
			update: {
				tokensConsumed: { increment: totalTokens },
				estimatedCostUsd: { increment: cost },
			},
			create: {
				tenantId,
				monthYear: currentMonth,
				tokensConsumed: totalTokens,
				estimatedCostUsd: cost,
				monthlyLimitUsd: 50.00
			}
		});

		// Check limit
		const updated = await this.prisma.llmQuota.findUnique({
			where: { tenantId_monthYear: { tenantId, monthYear: currentMonth } }
		});

		if (updated && updated.estimatedCostUsd.toNumber() >= updated.monthlyLimitUsd.toNumber()) {
			await this.prisma.llmQuota.update({
				where: { id: updated.id },
				data: { isLimitReached: true }
			});
		}
	}
}
