const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone untuk container Docker / VPS production.
  // Catatan: Pada OS Windows tanpa Developer Mode/Admin, symlink diblokir oleh OS (EPERM).
  // Otomatis aktif pada Linux/Docker atau jika BUILD_STANDALONE='true'.
  output: process.platform === 'win32' && process.env.BUILD_STANDALONE !== 'true' ? undefined : 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  transpilePackages: ['@oase/shared'],
};

module.exports = nextConfig;
