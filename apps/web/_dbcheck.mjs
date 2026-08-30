import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rows = await prisma.$queryRaw`select current_database() as db, current_schema() as schema`;
console.log('runtime target:', rows);

const tables = await prisma.$queryRaw`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
console.log('public tables:', tables);

await prisma.$disconnect();