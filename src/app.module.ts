import { Module } from '@nestjs/common';
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

@Module({
  imports: [AuthModule, TenantsModule, UsersModule, PrismaModule, CryptoModule, LinkedinModule, LlmModule, NotificationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
