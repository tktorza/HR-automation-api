import { Test } from '@nestjs/testing';
import { LlmService } from './src/llm/llm.service';

async function bootstrap() {
	const moduleRef = await Test.createTestingModule({
		providers: [LlmService],
	}).compile();

	const llmService = moduleRef.get<LlmService>(LlmService);
	llmService.onModuleInit();

	console.log('Testing Token Estimation...');
	const text = 'Hello world, this is a test.';
	const tokens = llmService.estimateTokens(text);
	console.log(`Text: "${text}" -> Tokens: ${tokens}`);

	if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('sk-ant-...')) {
		console.warn('SKIPPING API CALL: ANTHROPIC_API_KEY is not set or is a placeholder.');
		return;
	}

	try {
		console.log('Testing Real API Call...');
		const system = 'You are a helpful assistant. Respond in JSON: { "message": "string" }';
		const response = await llmService.generateResponse(system, 'Say hello');
		console.log('Response:', response);
	} catch (e) {
		console.error('API Call Failed:', e.message);
	}
}
bootstrap();
