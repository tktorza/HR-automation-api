import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
	constructor(private prisma: PrismaService) { }

	async getDashboardStats(tenantId: string) {
		const today = new Date();
		const startOfDay = new Date(today.setHours(0, 0, 0, 0));

		// 1. Active Accounts
		const activeAccounts = await this.prisma.linkedinAccount.count({
			where: { tenantId, isActive: true }
		});

		// 2. Conversations / Messages (Proxy)
		const totalConversations = await this.prisma.conversation.count({
			where: { tenantId }
		});

		const newConversationsToday = await this.prisma.conversation.count({
			where: {
				tenantId,
				lastMessageAt: { gte: startOfDay }
			}
		});

		// 3. LLM Usage (Current Month)
		const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
		const quota = await this.prisma.llmQuota.findUnique({
			where: { tenantId_monthYear: { tenantId, monthYear: currentMonth } }
		});

		const tokensUsed = quota ? Number(quota.tokensConsumed) : 0;
		const estimatedCost = quota ? Number(quota.estimatedCostUsd) : 0;

		return {
			activeAccounts: {
				value: activeAccounts,
				sub: "Total active"
			},
			messagesScraped: {
				value: totalConversations,
				sub: `+${newConversationsToday} today` // Conversations updated today
			},
			llmUsage: {
				value: tokensUsed.toLocaleString(), // e.g. "45,000"
				sub: `$${estimatedCost.toFixed(2)} estimated cost`
			}
		};
	}
}
