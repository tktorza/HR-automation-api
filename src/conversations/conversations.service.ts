import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
	constructor(private prisma: PrismaService) { }

	async findAll(tenantId: string) {
		return this.prisma.conversation.findMany({
			where: { tenantId },
			include: {
				contact: {
					select: {
						firstName: true,
						lastName: true,
						fullName: true,
						linkedinProfileUrl: true,
					}
				}
			},
			orderBy: {
				lastMessageAt: 'desc'
			}
		});
	}

	async findOne(id: string, tenantId: string) {
		const conversation = await this.prisma.conversation.findFirst({
			where: { id, tenantId },
			include: {
				contact: true,
				llmActions: {
					orderBy: { createdAt: 'desc' },
					take: 5
				}
			}
		});

		if (!conversation) {
			throw new NotFoundException('Conversation not found');
		}

		return conversation;
	}
}
