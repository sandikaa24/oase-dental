import { PrismaClient } from '@prisma/client';

async function inspect(label, url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  console.log('=== ' + label + ' ===');
  try {
    const who = await prisma.$queryRaw`select current_database() as db, current_schema() as sch, current_user as usr`;
    console.log('  target:', who[0]);

    const bySchema = await prisma.$queryRaw`
      select table_schema, count(*)::int as n
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('pg_catalog','information_schema')
      group by table_schema order by table_schema`;
    console.log('  tables per schema:', bySchema);

    const mig = await prisma.$queryRaw`
      select table_schema from information_schema.tables
      where table_name = '_prisma_migrations'`;
    console.log('  _prisma_migrations found in:', mig);
  } catch (e) {
    console.log('  GAGAL:', e.code, (e.message || '').split('\n')[0]);
  } finally {
    await prisma.$disconnect();
  }
}

await inspect('pooler DATABASE_URL', process.env.DATABASE_URL);
await inspect('direct DIRECT_URL', process.env.DIRECT_URL);