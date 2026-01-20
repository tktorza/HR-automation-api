import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class LlmService implements OnModuleInit {
	private anthropic: Anthropic;
	private readonly logger = new Logger(LlmService.name);

	// Model config
	private readonly model = 'claude-3-sonnet-20240229';
	private readonly maxTokens = 1000;

	onModuleInit() {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			this.logger.error('ANTHROPIC_API_KEY is not defined. LLM features will fail.');
		}

		this.anthropic = new Anthropic({
			apiKey: apiKey,
		});
	}

	async generateResponse(systemPrompt: string, userMessage: string): Promise<any> {
		try {
			this.logger.log('Sending request to Claude API...');

			const msg = await this.anthropic.messages.create({
				model: this.model,
				max_tokens: this.maxTokens,
				system: systemPrompt,
				messages: [
					{ role: "user", content: userMessage }
				]
			});

			const contentBlock = msg.content[0];
			if (contentBlock.type !== 'text') {
				throw new Error('Unexpected response type from Claude');
			}

			this.logger.debug(`Claude Response: ${contentBlock.text}`);

			// Parse JSON
			try {
				return JSON.parse(contentBlock.text);
			} catch (parseError) {
				this.logger.error('Failed to parse JSON response', contentBlock.text);
				throw new Error('LLM did not return valid JSON');
			}

		} catch (error) {
			this.logger.error('Error calling Anthropic API', error);
			throw error;
		}
	}

	// Simple rule of thumb estimation for V1
	estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}
}
