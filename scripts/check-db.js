
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
	const count = await prisma.conversation.count();
	console.log(`Conversation Count: ${count}`);
	const contacts = await prisma.contact.count();
	console.log(`Contact Count: ${contacts}`);

	if (count > 0) {
		const first = await prisma.conversation.findFirst({ include: { contact: true } });
		console.log('Sample Conversation:', JSON.stringify(first, null, 2));
	}
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
