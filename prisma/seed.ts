import { PrismaClient, Role, ProofStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@adahi.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'مدير النظام',
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const order = await prisma.order.upsert({
    where: { orderNumber: 'DEMO-001' },
    update: {},
    create: {
      orderNumber: 'DEMO-001',
      customerName: 'أحمد محمد',
      customerMobile: '0501234567',
      customerMobileLast4: '4567',
      customerEmail: 'demo@adahi.com',
      sallaStatus: 'paid',
      proofStatus: ProofStatus.READY,
      proofToken: 'demo-proof-token-12345',
    },
  });

  await prisma.orderItem.upsert({
    where: { id: `${order.id}-item-1` },
    update: {},
    create: {
      id: `${order.id}-item-1`,
      orderId: order.id,
      productName: 'أضحية بقري مو طبيعي',
      quantity: 1,
      sku: 'COW-001',
      price: 3500,
    },
  });

  console.log('✓ Seed completed');
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Admin user created/updated`);
  console.log(`  Demo Order: ${order.orderNumber}`);
  console.log(`  Proof Token: ${order.proofToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });