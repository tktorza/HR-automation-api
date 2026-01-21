import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
	constructor(private prisma: PrismaService) { }

	async getSettings(tenantId: string) {
		const config = await this.prisma.onboardingConfig.findUnique({
			where: { tenantId },
		});

		// Create Default if not exists
		if (!config) {
			return this.prisma.onboardingConfig.create({
				data: { tenantId }
			});
		}

		return config;
	}

	async updateSettings(tenantId: string, data: any) {
		// Only allow specific fields
		const { googleAiApiKey, llmProviderPreference, confidenceThreshold } = data;

		return this.prisma.onboardingConfig.upsert({
			where: { tenantId },
			update: {
				googleAiApiKey,
				llmProviderPreference,
				confidenceThreshold: confidenceThreshold ? parseInt(confidenceThreshold) : undefined,
			},
			create: {
				tenantId,
				googleAiApiKey,
				llmProviderPreference,
				confidenceThreshold: confidenceThreshold ? parseInt(confidenceThreshold) : 70,
			},
		});
	}
}
