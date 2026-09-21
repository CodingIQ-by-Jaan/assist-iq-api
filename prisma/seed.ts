import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const main = async () => {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@codingiq.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Define SEED_ADMIN_PASSWORD (mínimo 8 caracteres)');
  }

  const admin = await prisma.usuarioAdmin.upsert({
    where: { email },
    update: {},
    create: {
      email,
      nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Administrador',
      passwordHash: await bcrypt.hash(password, 12),
      rol: Rol.SUPER_ADMIN,
    },
  });
  console.log(`SUPER_ADMIN listo: ${admin.email}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
