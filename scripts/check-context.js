
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
	const account = await prisma.linkedinAccount.findFirst();
	console.log('Account ID:', account.id);
	console.log('Context Synthesis Length:', account.contextSynthesis ? account.contextSynthesis.length : 0);
	console.log('Context Synthesis Value:', account.contextSynthesis);

	const convCount = await prisma.conversation.count();
	console.log('Total Conversations in DB:', convCount);
}

main()
	.catch(e => console.error(e))
	.finally(async () => await prisma.$disconnect());
