/**
 * prisma/seed.ts
 * Creates the initial SUPER_ADMIN user and a default workspace.
 * Run with: npm run db:seed (from apps/api)
 *
 * Change credentials immediately after first run.
 */

import { PrismaClient, Role, Plan } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Default workspace ─────────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'fstail-solutions' },
    update: {},
    create: {
      name: 'FSTail Solutions',
      slug: 'fstail-solutions',
      plan: Plan.PRO,
      settings: {},
      // owner set after user creation
      ownerId: 'placeholder', // will be updated below
    },
  });

  // ── SUPER_ADMIN user ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fstailsolutions.com.ar' },
    update: {},
    create: {
      email: 'admin@fstailsolutions.com.ar',
      passwordHash,
      displayName: 'FSTail Admin',
      role: Role.SUPER_ADMIN,
      workspaceId: workspace.id,
      emailVerifiedAt: new Date(),
    },
  });

  // Update workspace owner to real admin ID
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { ownerId: admin.id },
  });

  // ── Default audit template ────────────────────────────────────────
  const defaultTemplateId = 'a0000000-0000-0000-0000-000000000001';
  await prisma.auditTemplate.upsert({
    where: { id: defaultTemplateId },
    update: {},
    create: {
      id: defaultTemplateId,
      name: 'Web Presence Audit',
      description: 'Standard web audit covering performance, SEO, UX, security, and accessibility',
      isDefault: true,
      sections: [
        { key: 'performance', label: 'Performance', weight: 20, criteria: [] },
        { key: 'seo', label: 'SEO & Visibility', weight: 20, criteria: [] },
        { key: 'ux', label: 'UX & Design', weight: 20, criteria: [] },
        { key: 'security', label: 'Security', weight: 20, criteria: [] },
        { key: 'accessibility', label: 'Accessibility', weight: 10, criteria: [] },
        { key: 'content', label: 'Content & Copy', weight: 10, criteria: [] },
      ],
    },
  });

  console.log('');
  console.log('✅ Seed complete');
  console.log(`   Workspace: FSTail Solutions (${workspace.id})`);
  console.log(`   Admin: admin@fstailsolutions.com.ar`);
  console.log(`   Password: ChangeMe123!`);
  console.log('');
  console.log('⚠️  Change the admin password immediately after first login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
