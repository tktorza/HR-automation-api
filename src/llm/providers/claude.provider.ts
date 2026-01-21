import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';

export class ClaudeProvider {
	private anthropic: Anthropic;
	private readonly logger = new Logger(ClaudeProvider.name);

	// Model config
	private readonly model = 'claude-3-sonnet-20240229'; // Fallback usage
	private readonly haikuModel = 'claude-3-haiku-20240307';
	private readonly maxTokens = 1000;

	constructor(apiKey: string) {
		this.anthropic = new Anthropic({
			apiKey: apiKey,
		});
	}

	async generateResponse(systemPrompt: string, userMessage: string, useHaiku = true): Promise<any> {
		try {
			const modelToUse = useHaiku ? this.haikuModel : this.model;
			this.logger.log(`Calling Anthropic (${modelToUse})...`);

			const msg = await this.anthropic.messages.create({
				model: modelToUse,
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

			return {
				content: JSON.parse(contentBlock.text),
				usage: msg.usage
			};

		} catch (error) {
			this.logger.error('Error calling Anthropic API', error);
			throw error;
		}
	}

	estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}
}
