import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const contactName = 'Jessy Miller';

	const conversation = await prisma.conversation.findFirst({
		where: { contact: { fullName: { contains: contactName } } }
	});

	if (!conversation) {
		console.log('Conversation not found.');
		return;
	}

	// FORCE RESET TO PENDING_LLM and UNREAD = 1 (Since we know there is 1 message from him)
	const messages = (conversation.messages as any[]) || [];
	const realUnread = messages.length;

	console.log(`Resetting conversation ${conversation.id}...`);
	console.log(`Setting Status -> PENDING_LLM`);
	console.log(`Setting Unread -> ${realUnread}`);

	await prisma.conversation.update({
		where: { id: conversation.id },
		data: {
			processingStatus: 'PENDING_LLM',
			unreadCount: realUnread > 0 ? realUnread : 1 // Force at least 1 to trigger logic
		}
	});

	console.log('Done. You can run the workflow now.');
}

main()
	.catch(e => console.error(e))
	.finally(async () => await prisma.$disconnect());
