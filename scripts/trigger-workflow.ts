import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrchestratorService } from '../src/orchestrator/orchestrator.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
	const logger = new Logger('ManualTrigger');

	try {
		logger.log('Bootstrapping application context...');
		const app = await NestFactory.createApplicationContext(AppModule);

		logger.log('Getting OrchestratorService...');
		const orchestrator = app.get(OrchestratorService);

		logger.log('Triggering workflow...');
		await orchestrator.runWorkflow('MANUAL_CLI');

		logger.log('Workflow completed. Closing application.');
		await app.close();
		process.exit(0);
	} catch (error) {
		logger.error('Failed to run workflow', error);
		process.exit(1);
	}
}

bootstrap();
