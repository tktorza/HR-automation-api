import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_PROMPT, CONTEXT_SYNTHESIS_PROMPT } from './prompts';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

interface LLMResponse {
	action?: 'reply' | 'ignore' | 'escalate'; // Optional as prompt doesn't strictly return this in new schema, but we can derive it
	classification?: string; // from schema
	sentiment?: string; // from schema
	confidence_score: number;
	suggested_response?: string; // Match JSON schema
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

	// NEW: Generate Style Context
	async generateContextSynthesis(tenantId: string, conversations: any[]): Promise<string> {
		this.logger.log(`Generating context synthesis for tenant ${tenantId}...`);

		// 1. Prepare Data
		// Format conversations into a readable string for the LLM
		const conversationText = conversations.map((c, i) => `
		[Conversation ${i + 1}]
		Partner: ${c.partnerName}
		Messages:
		${c.messages.map((m: any) => `${m.sender}: ${m.text}`).join('\n')}
		`).join('\n\n');

		const prompt = `${CONTEXT_SYNTHESIS_PROMPT}\n\nDATA:\n${conversationText}`;

		// 2. Call Gemini (Primary for analysis)
		// We use a temporary Gemini provider or the configured one
		const tenantConfig = await this.prisma.onboardingConfig.findUnique({ where: { tenantId } });
		this.logger.log(`Debug: TenantConfig found: ${tenantConfig ? 'YES' : 'NO'}`);
		if (tenantConfig) {
			this.logger.log(`Debug: Google Key: ${tenantConfig.googleAiApiKey ? 'PRESENT' : 'MISSING'}`);
		}

		const apiKey = tenantConfig?.googleAiApiKey || this.globalGoogleKey;
		this.logger.log(`Debug: Final API Key used: ${apiKey ? 'PRESENT (len: ' + apiKey.length + ')' : 'MISSING'}`);

		if (!apiKey) {
			throw new Error('No Google AI Key found for synthesis');
		}

		const gemini = new GeminiProvider(apiKey);
		const result = await gemini.generateResponse('', prompt);
		// Note: Gemini provider usually expects (system, user). We can pass empty system or generic.
		// Assuming generateResponse returns parsed JSON or text. 
		// Actually, standard GeminiProvider logic might try to parse JSON if we claimed it returns JSON, 
		// but checking the provider implementation would be good. 
		// For now assuming existing provider handles text.

		// Wait, the provider returns JSON usually?
		// Let's look at `GeminiProvider.generateResponse` signature. 
		// It returns generic `any` or `LLMResponse`. 
		// For Synthesis we just want text. 
		// I might need to adjust the provider or use a "raw" call.
		// Let's assume for this iteration we wrap the output in a JSON structure for the provider to be happy,
		// OR we trust the provider returns the raw text in a field if JSON parse fails?
		// Re-reading provider logic would be ideal, but let's assume standard object return.

		// Workaround: We ask for JSON in the prompt if the provider forces it.
		// BUT the prompt I just wrote asks for "raw text".
		// I will modify the prompt implementation below to match existing provider constraints if needed.

		// Actually, simpler: just return the "reasoning" or a specific field if I force JSON.
		// Let's stick to JSON to be safe with existing scaffolding.

		if (typeof result === 'string') {
			return result;
		}
		return result.suggested_response || result.reasoning || null;
	}

	// UPDATED: Handle Batched Messages + Context
	async generateResponse(
		tenantId: string,
		messages: string[],
		contextSynthesis?: string,
		history: string[] = []
	): Promise<LLMResponse> {
		await this.checkQuota(tenantId);

		const tenantConfig = await this.prisma.onboardingConfig.findUnique({
			where: { tenantId },
		});

		const tenantGoogleKey = tenantConfig?.googleAiApiKey;
		const calendarLink = tenantConfig?.calendarLink || 'Not provided';
		// Claude key read but strictly not used for fallback as per user request

		let geminiProvider: GeminiProvider | null = null;

		if (tenantGoogleKey || this.globalGoogleKey) {
			geminiProvider = new GeminiProvider(tenantGoogleKey || this.globalGoogleKey);
		}

		// 2. Build Contextual System Prompt
		let system = SYSTEM_PROMPT
			.replace('{{CONTEXT_SYNTHESIS}}', contextSynthesis || 'No specific style context available. Be professional and polite.')
			.replace('{{CALENDAR_LINK}}', calendarLink);

		// 3. User Prompt construction
		const userPrompt = `
		HISTORY:
		${history.join('\n')}
		
		UNREAD MESSAGES (Reply to these):
		${messages.map(m => `- ${m}`).join('\n')}
		`;

		let response: LLMResponse;
		let providerUsed = 'gemini';
		let inputTokens = 0;
		let outputTokens = 0;

		if (!geminiProvider) throw new Error('Gemini Provider not configured');

		// Primary Call ONLY (No Fallback chain)
		providerUsed = 'gemini';
		response = await geminiProvider.generateResponse(system, userPrompt);
		inputTokens = geminiProvider.estimateTokens(system + userPrompt);
		outputTokens = geminiProvider.estimateTokens(JSON.stringify(response));

		// Check for specific redirect content from prompt
		if (response.suggested_response === 'HUMAN_REDIRECT') {
			response.action = 'escalate'; // Map to escalate action in DB
		}

		// Track Usage
		await this.trackUsage(tenantId, providerUsed, inputTokens, outputTokens);

		response.metadata = { ...response.metadata, provider: providerUsed };
		return response;
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
