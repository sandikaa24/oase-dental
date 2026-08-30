const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'cashier@oase.id' }});
  
  if (!user) {
    console.log("User cashier@oase.id not found!");
    return;
  }

  const tokens = await prisma.refreshToken.findMany({ 
    where: { userId: user.id }, 
    orderBy: { createdAt: 'asc' } 
  });
  console.log('=== B5. RefreshTokens ===');
  console.log(tokens.map(t => ({ id: t.id, revokedAt: t.revokedAt, expiresAt: t.expiresAt })));
  
  const logs = await prisma.auditLog.findMany({
    where: { actorId: user.id, action: 'SWITCH_BRANCH' },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  console.log('\n=== B6. AuditLog ===');
  console.log(logs.map(l => ({ id: l.id, action: l.action, entityId: l.entityId, note: l.note, createdAt: l.createdAt })));
  
  await prisma.$disconnect();
}

run();
