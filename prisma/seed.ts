/**
 * prisma/seed.ts
 * Creates the initial SUPER_ADMIN users and a default workspace.
 * Run with: npm run db:seed (from apps/api)
 */

import { PrismaClient, Role, Plan } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  // ─────────────────────────────────────────────────────────────
  // 1. Crear Workspace SIN owner
  // ─────────────────────────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: {
      slug: 'fstail-solutions',
    },
    update: {},
    create: {
      name: 'FSTail Solutions',
      slug: 'fstail-solutions',
      plan: Plan.PRO,
      settings: {},
      ownerId: null,
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Crear Nahuel
  // ─────────────────────────────────────────────────────────────
  const nahuel = await prisma.user.upsert({
    where: {
      email: 'nahuel@fstailsolutions.com.ar',
    },
    update: {},
    create: {
      email: 'nahuel@fstailsolutions.com.ar',
      passwordHash,
      displayName: 'Nahuel Nicolás Pierini',
      role: Role.SUPER_ADMIN,
      workspaceId: workspace.id,
      emailVerifiedAt: new Date(),
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Crear Ana
  // ─────────────────────────────────────────────────────────────
  const ana = await prisma.user.upsert({
    where: {
      email: 'anaclara@fstailsolutions.com.ar',
    },
    update: {},
    create: {
      email: 'anaclara@fstailsolutions.com.ar',
      passwordHash,
      displayName: 'Ana Clara Ferrando',
      role: Role.SUPER_ADMIN,
      workspaceId: workspace.id,
      emailVerifiedAt: new Date(),
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Asignar owner del Workspace
  // ─────────────────────────────────────────────────────────────
  await prisma.workspace.update({
    where: {
      id: workspace.id,
    },
    data: {
      ownerId: nahuel.id,
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Template por defecto
  // ─────────────────────────────────────────────────────────────
  const defaultTemplateId = 'a0000000-0000-0000-0000-000000000001';

  await prisma.auditTemplate.upsert({
    where: {
      id: defaultTemplateId,
    },
    update: {},
    create: {
      id: defaultTemplateId,
      name: 'Web Presence Audit',
      description:
        'Standard web audit covering performance, SEO, UX, security, and accessibility',
      isDefault: true,
      sections: [
        {
          key: 'performance',
          label: 'Performance',
          weight: 20,
          criteria: [],
        },
        {
          key: 'seo',
          label: 'SEO & Visibility',
          weight: 20,
          criteria: [],
        },
        {
          key: 'ux',
          label: 'UX & Design',
          weight: 20,
          criteria: [],
        },
        {
          key: 'security',
          label: 'Security',
          weight: 20,
          criteria: [],
        },
        {
          key: 'accessibility',
          label: 'Accessibility',
          weight: 10,
          criteria: [],
        },
        {
          key: 'content',
          label: 'Content & Copy',
          weight: 10,
          criteria: [],
        },
      ],
    },
  });

  console.log('');
  console.log('✅ Seed complete');
  console.log(`Workspace: FSTail Solutions (${workspace.id})`);
  console.log('');

  console.log('Usuarios creados');
  console.log('────────────────────────────────────────');

  console.log('1. Nahuel Nicolás Pierini');
  console.log('   Rol: SUPER_ADMIN');
  console.log('   Owner: Sí');
  console.log('   Email: nahuel@fstailsolutions.com.ar');
  console.log('   Password: ChangeMe123!');
  console.log('');

  console.log('2. Ana Clara Ferrando');
  console.log('   Rol: SUPER_ADMIN');
  console.log('   Owner: No');
  console.log('   Email: anaclara@fstailsolutions.com.ar');
  console.log('   Password: ChangeMe123!');
  console.log('');

  console.log('⚠️ Cambiá las contraseñas luego del primer login.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });