import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	const targets = ['Jessy Miller', 'Ilan Hayat'];
	console.log(`Resetting data for: ${targets.join(', ')}`);

	for (const name of targets) {
		const contact = await prisma.contact.findFirst({
			where: { fullName: { contains: name } }
		});

		if (!contact) {
			console.log(`Contact ${name} not found.`);
			continue;
		}

		const conv = await prisma.conversation.findFirst({
			where: { contactId: contact.id }
		});

		if (conv) {
			// Delete Actions first
			const actions = await prisma.llmAction.deleteMany({
				where: { conversationId: conv.id }
			});
			console.log(`Deleted ${actions.count} LLM Actions for ${name}`);

			// Delete Conversation
			await prisma.conversation.delete({
				where: { id: conv.id }
			});
			console.log(`Deleted Conversation for ${name}`);
		} else {
			console.log(`No conversation found for ${name}`);
		}
	}

	console.log('Reset complete. Context (Account/Contacts) preserved.');
}

main()
	.catch(e => console.error(e))
	.finally(async () => await prisma.$disconnect());
