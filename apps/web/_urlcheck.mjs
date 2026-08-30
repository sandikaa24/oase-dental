// Diagnostik: tampilkan HANYA host/port/dbname. Kredensial tidak pernah dicetak.
function describe(name) {
  const raw = process.env[name];
  if (!raw) return name + ' = (tidak diset)';

  try {
    const u = new URL(raw);
    return [
      name,
      '  host   : ' + u.hostname,
      '  port   : ' + (u.port || '(default)'),
      '  dbname : ' + JSON.stringify(u.pathname.replace(/^\//, '')),
      '  params : ' + (u.search || '(none)'),
    ].join('\n');
  } catch {
    return name + ' = TIDAK BISA DIPARSE sebagai URL';
  }
}

console.log(describe('DATABASE_URL'));
console.log(describe('DIRECT_URL'));