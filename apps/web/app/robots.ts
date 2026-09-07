import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oase-dental-web.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/layanan', '/cabang', '/tentang-kami'],
        disallow: ['/admin/', '/api/', '/login'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
