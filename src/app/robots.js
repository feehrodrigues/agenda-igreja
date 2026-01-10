export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/sign-in/', '/sign-up/'],
    },
    sitemap: 'https://agenda-igreja.vercel.app/sitemap.xml',
  }
}