import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { LinkedinModule } from '../linkedin/linkedin.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
	imports: [
		ScheduleModule.forRoot(),
		LinkedinModule,
		LlmModule,
		PrismaModule,
		CryptoModule,
		NotificationsModule,
	],
	providers: [OrchestratorService],
	controllers: [OrchestratorController],
})
export class OrchestratorModule { }
