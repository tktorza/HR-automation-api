import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { LinkedinModule } from './linkedin/linkedin.module';
import { LlmModule } from './llm/llm.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { ConversationsModule } from './conversations/conversations.module';
import { SettingsModule } from './settings/settings.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		ScheduleModule.forRoot(),
		AuthModule,
		TenantsModule,
		UsersModule,
		PrismaModule,
		CryptoModule,
		LinkedinModule,
		LlmModule,
		NotificationsModule,
		OrchestratorModule,
		ConversationsModule,
		SettingsModule,
		AnalyticsModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
