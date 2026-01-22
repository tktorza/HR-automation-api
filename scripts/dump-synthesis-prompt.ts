import { PrismaClient } from '@prisma/client';
import { CONTEXT_SYNTHESIS_PROMPT } from '../src/llm/prompts';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
	const prisma = new PrismaClient();

	try {
		console.log('Fetching conversations...');
		const account = await prisma.linkedinAccount.findFirst();
		if (!account) {
			console.error('No account found.');
			return;
		}

		// Fetch conversations with Contact to get partner name
		const conversations = await prisma.conversation.findMany({
			where: { tenantId: account.tenantId },
			take: 20,
			orderBy: { lastMessageAt: 'desc' },
			include: { contact: true }
		}) as any[];

		console.log(`Found ${conversations.length} conversations.`);

		const conversationText = conversations.map((c, i) => {
			// Map partnerName from Contact
			const partnerName = c.contact?.fullName || 'Unknown';

			const msgs = Array.isArray(c.messages) ? c.messages : [];
			const formattedMsgs = msgs.map((m: any) => {
				if (typeof m === 'string') return `Unknown: ${m}`;
				return `${m.sender || 'Unknown'}: ${m.text || ''}`;
			}).join('\n');

			return `
    [Conversation ${i + 1}]
    Partner: ${partnerName}
    Messages:
    ${formattedMsgs}
    `;
		}).join('\n\n');

		const prompt = `${CONTEXT_SYNTHESIS_PROMPT}\n\nDATA:\n${conversationText}`;

		const outputPath = path.resolve(process.cwd(), 'debug_synthesis_prompt.txt');
		fs.writeFileSync(outputPath, prompt);
		console.log(`Prompt dumped to: ${outputPath}`);

	} catch (error) {
		console.error('Error dumping prompt:', error);
	} finally {
		await prisma.$disconnect();
	}
}

main();
