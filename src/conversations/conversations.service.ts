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

		// Parse messages (JSON)
		let messagesArray: any[] = [];
		try {
			if (typeof conversation.messages === 'string') {
				messagesArray = JSON.parse(conversation.messages);
			} else if (Array.isArray(conversation.messages)) {
				messagesArray = conversation.messages;
			}
		} catch (e) {
			messagesArray = []; // fallback
		}

		// Map stored messages to Frontend Spec
		const mappedMessages = messagesArray.map((msg: any) => {
			// Handle legacy string format if any
			if (typeof msg === 'string') {
				return {
					text: msg,
					createdAt: new Date().toISOString(), // Unknown date for legacy
					sender: 'contact', // Default assumption or unknown
					metadata: { isLlmGenerated: false }
				};
			}

			// Handle new object format
			return {
				text: msg.text,
				createdAt: msg.createdAt || new Date().toISOString(),
				sender: msg.sender || 'contact',
				metadata: msg.metadata || { isLlmGenerated: false }
			};
		});

		// Map LLM Actions (Drafts)
		const llmActions = conversation.llmActions
			.filter(action => action.actionType === 'REPLY_SUGGESTION')
			.map(action => ({
				confidenceScore: Number(action.confidenceScore) || 0,
				llmResponse: action.llmResponse
			}));

		return {
			id: conversation.id,
			contact: {
				fullName: conversation.contact?.fullName,
				firstName: conversation.contact?.firstName,
				lastName: conversation.contact?.lastName,
				linkedinProfileUrl: conversation.contact?.linkedinProfileUrl
			},
			messages: mappedMessages,
			llmActions: llmActions
		};
	}
}
