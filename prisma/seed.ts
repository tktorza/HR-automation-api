import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
	console.log('Seeding database...');

	// 1. Create Demo Tenant
	const tenantName = 'Demo Corp';
	const tenantSlug = 'demo-corp';

	const existingTenant = await prisma.tenant.findUnique({
		where: { slug: tenantSlug },
	});

	let tenantId: string;

	if (existingTenant) {
		console.log(`Tenant '${tenantName}' already exists. ID: ${existingTenant.id}`);
		tenantId = existingTenant.id;
	} else {
		const tenant = await prisma.tenant.create({
			data: {
				name: tenantName,
				slug: tenantSlug,
				settings: { theme: 'light', language: 'en' },
			},
		});
		console.log(`Created Tenant '${tenantName}'. ID: ${tenant.id}`);
		tenantId = tenant.id;
	}

	// 2. Create Admin User
	const adminEmail = 'admin@demo.com';
	const existingUser = await prisma.user.findUnique({
		where: { email: adminEmail },
	});

	if (existingUser) {
		console.log(`User '${adminEmail}' already exists. ID: ${existingUser.id}`);
	} else {
		const salt = await bcrypt.genSalt(10);
		const passwordHash = await bcrypt.hash('admin123', salt);

		const user = await prisma.user.create({
			data: {
				email: adminEmail,
				passwordHash: passwordHash,
				tenantId: tenantId,
				role: 'admin',
			},
		});
		console.log(`Created User '${adminEmail}'. ID: ${user.id}`);
	}

	console.log('Seeding finished.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
