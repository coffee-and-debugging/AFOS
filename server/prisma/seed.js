const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Users
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: '1',
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      name: 'Admin',
    },
  });

  await prisma.user.upsert({
    where: { username: 'chef' },
    update: {},
    create: {
      id: '2',
      username: 'chef',
      password: await bcrypt.hash('chef123', 10),
      role: 'chef',
      name: 'Chef',
    },
  });

  // Menu items — only seed if empty (ids are auto-assigned sequentially)
  const count = await prisma.menuItem.count();
  if (count === 0) {
    await prisma.menuItem.createMany({
      data: [
        { name: 'Green Tea',    description: 'Refreshing Japanese green tea',  price: 150, category: 'tea',  available: true },
        { name: 'Oolong Tea',   description: 'Premium semi-oxidized oolong',   price: 200, category: 'tea',  available: true },
        { name: 'Matcha Latte', description: 'Smooth matcha with steamed milk',price: 280, category: 'tea',  available: true },
        { name: 'Earl Grey',    description: 'Classic bergamot black tea',     price: 150, category: 'tea',  available: true },
        { name: 'Chamomile',    description: 'Soothing herbal chamomile',      price: 150, category: 'tea',  available: true },
        { name: 'Egg Tart',     description: 'Freshly baked silky egg tart',   price: 120, category: 'food', available: true },
        { name: 'Scone',        description: 'Buttery scone with jam & cream', price: 180, category: 'food', available: true },
        { name: 'Tea Sandwich', description: 'Assorted finger sandwiches',     price: 250, category: 'food', available: true },
        { name: 'Almond Cake',  description: 'Light almond sponge cake slice', price: 220, category: 'food', available: true },
      ],
    });
    console.log('Menu items seeded (ids 1-9).');
  } else {
    console.log(`Menu items already exist (${count} items), skipping seed.`);
  }

  // Tables
  const tables = [
    { id: 'table-1', number: 1 },
    { id: 'table-2', number: 2 },
    { id: 'table-3', number: 3 },
    { id: 'table-4', number: 4 },
  ];

  for (const table of tables) {
    await prisma.table.upsert({
      where: { id: table.id },
      update: {},
      create: table,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
