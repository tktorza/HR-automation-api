import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
	imports: [PrismaModule],
	providers: [LlmService],
	exports: [LlmService],
})
export class LlmModule { }
