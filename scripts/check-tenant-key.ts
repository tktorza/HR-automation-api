
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkKeys() {
	const tenantId = 'd1664d8a-8368-4af0-aa7d-dcc2fedfa658'; // From logs
	console.log(`Checking config for tenant: ${tenantId}`);

	const config = await prisma.onboardingConfig.findUnique({
		where: { tenantId },
	});

	if (!config) {
		console.log('No OnboardingConfig found for this tenant.');
	} else {
		console.log('OnboardingConfig found:');
		console.log('Google Key Present:', !!config.googleAiApiKey);
		console.log('Anthropic Key Present:', !!config.anthropicAiApiKey);
		console.log('Google Key Length:', config.googleAiApiKey?.length);
	}

	await prisma.$disconnect();
}

checkKeys().catch(console.error);
