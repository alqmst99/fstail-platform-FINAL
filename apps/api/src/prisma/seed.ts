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
      name: 'Professional Web Audit',
      description: 'Audit completo de presencia web, UX, conversión, SEO, performance, accesibilidad y seguridad',
      isDefault: true,
      sections: [
        ['firstImpression', 'Primera impresión', 5], ['header', 'Header & Hero', 5],
        ['home', 'Home', 5], ['about', 'About', 4], ['services', 'Servicios', 6],
        ['portfolio', 'Portfolio', 5], ['testimonials', 'Testimonios', 4],
        ['faq', 'FAQ', 3], ['blog', 'Blog', 3], ['contact', 'Contacto', 6],
        ['footer', 'Footer', 3], ['responsive', 'Responsive', 6],
        ['performance', 'Performance', 10], ['seo', 'SEO & Visibility', 10],
        ['accessibility', 'Accesibilidad', 8], ['security', 'Seguridad', 8],
        ['ux', 'UX', 6], ['conversion', 'Conversión', 8], ['content', 'Contenido', 8],
      ].map(([key, label, weight]) => ({ key, label, weight, criteria: [] })),
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
