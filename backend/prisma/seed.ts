import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin@123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@parentguard.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@parentguard.com',
      passwordHash: hash,
      role: 'admin',
    },
  });

  console.log('✓ Admin user ready');
  console.log('  Email   :', admin.email);
  console.log('  Password: Admin@123');
  console.log('  Role    :', admin.role);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
