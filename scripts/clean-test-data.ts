import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	console.log('Cleaning database data...');

	// Order matters due to foreign keys if cascade isn't perfect, but Prisma handles it well usually.
	// Deleting in reverse order of dependency.

	const deletedActions = await prisma.llmAction.deleteMany({});
	console.log(`Deleted ${deletedActions.count} LLM Actions.`);

	const deletedConversations = await prisma.conversation.deleteMany({});
	console.log(`Deleted ${deletedConversations.count} Conversations.`);

	console.log('Deleted contacts.');

	// Reset contextSynthesis REMOVED as per user request (Preserve Persona)
	// await prisma.linkedinAccount.updateMany({ data: { contextSynthesis: null } });

	console.log('Cleanup complete (History cleared, Context preserved).');

	console.log('Cleanup complete.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
