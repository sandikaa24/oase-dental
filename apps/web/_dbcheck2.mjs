import { PrismaClient } from '@prisma/client';

// Bandingkan isi database via pooler (DATABASE_URL) vs direct (DIRECT_URL).
async function countTables(label, url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.$queryRaw`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
    console.log(label + ' -> public tables: ' + rows[0].n);
  } catch (e) {
    console.log(label + ' -> GAGAL: ' + e.code + ' ' + (e.message || '').split('\n')[0]);
  } finally {
    await prisma.$disconnect();
  }
}

await countTables('pooler (DATABASE_URL)', process.env.DATABASE_URL);
await countTables('direct (DIRECT_URL) ', process.env.DIRECT_URL);