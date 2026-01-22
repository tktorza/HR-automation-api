import { GoogleGenerativeAI } from '@google/generative-ai';
import { Logger } from '@nestjs/common';

export class GeminiProvider {
	private client: GoogleGenerativeAI;
	private readonly logger = new Logger(GeminiProvider.name);

	constructor(apiKey: string) {
		this.client = new GoogleGenerativeAI(apiKey);
	}

	async generateResponse(systemPrompt: string, userMessage: string): Promise<any> {
		try {
			this.logger.debug(`Gemini Prompt: ${systemPrompt}\n${userMessage}`);
			const model = this.client.getGenerativeModel({
				model: 'gemini-2.5-flash',
				generationConfig: {
					responseMimeType: 'application/json',
					temperature: 0.7,
				},
				systemInstruction: systemPrompt
			});

			const result = await model.generateContent(userMessage);
			const responseText = result.response.text();

			this.logger.debug(`Gemini Response: ${responseText}`);

			return JSON.parse(responseText);
		} catch (error) {
			this.logger.error('Gemini generation failed', error);
			throw error;
		}
	}

	estimateTokens(text: string): number {
		// Gemini token estimation is roughly 4 chars/token, similar to standard
		return Math.ceil(text.length / 4);
	}
}
