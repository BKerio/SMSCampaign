import 'dotenv/config';
import { Role } from '../src/generated/prisma/index.js';
import { createPrismaClient } from '../src/lib/prisma.js';
import bcrypt from 'bcrypt';

const prisma = createPrismaClient();

const ADMIN_EMAIL = 'admin@sms.com';
const ADMIN_PASSWORD = 'Admin@123!';
// Earlier seeds created the admin under this address - it is renamed in place
// so its members, campaigns and audit history stay attached to it.
const LEGACY_ADMIN_EMAIL = 'admin@example.com';

async function main() {
  console.log('🌱 Starting seed...');

  // Only the initial Super Admin - everything else (operators, groups,
  // members) is created through the app itself.
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  const legacy = existing ? null : await prisma.user.findUnique({ where: { email: LEGACY_ADMIN_EMAIL } });
  if (legacy) {
    await prisma.user.update({ where: { id: legacy.id }, data: { email: ADMIN_EMAIL } });
    console.log(`↪️  Renamed ${LEGACY_ADMIN_EMAIL} to ${ADMIN_EMAIL}`);
  }

  // Re-running the seed resets the admin's password and makes sure the
  // account is an active Super Admin, so it doubles as a lockout recovery.
  const superAdmin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: Role.SUPER_ADMIN, isActive: true },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'System Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✅ Super Admin: ${superAdmin.email} (${superAdmin.name})`);

  console.log('\n🎉 Seed complete!');
  console.log('─────────────────────────────────────');
  console.log('Super Admin credentials:');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
