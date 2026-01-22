import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const contactName = 'Ilan Hayat';
	console.log(`Searching for contact: ${contactName}...`);

	const contact = await prisma.contact.findFirst({
		where: { fullName: { contains: contactName } } // Use contains for safety
	});

	if (!contact) {
		console.error(`Contact '${contactName}' not found in DB.`);
		return;
	}

	const conversation = await prisma.conversation.findFirst({
		where: { contactId: contact.id },
		include: { llmActions: true }
	});

	if (!conversation) {
		console.error(`No conversation found for contact ID ${contact.id}`);
		return;
	}

	console.log('\n=== CONVERSATION STATE ===');
	console.log(`ID: ${conversation.id}`);
	console.log(`Status: ${conversation.processingStatus}`);
	console.log(`Unread Count: ${conversation.unreadCount}`);
	console.log(`Last Scraped: ${conversation.lastScrapedAt}`);
	console.log(`Thread URL: ${conversation.threadUrl}`);

	const messages = (conversation.messages as any[]) || [];
	console.log(`\nTotal Messages: ${messages.length}`);

	const last3 = messages.slice(-3);
	console.log('\n--- Last 3 Messages ---');
	last3.forEach((m, i) => {
		console.log(`[${i}] ${m.sender}: ${m.text?.substring(0, 50)}...`);
	});

	console.log('\n=== PENDING ACTIONS ===');
	if (conversation.llmActions.length === 0) {
		console.log('No LLM Actions recorded.');
	} else {
		conversation.llmActions.slice(-3).forEach(a => {
			console.log(`- ${a.actionType} (${a.createdAt.toISOString()}): ${a.finalMessage?.substring(0, 30)}...`);
		});
	}
}

main()
	.catch(e => console.error(e))
	.finally(async () => await prisma.$disconnect());
