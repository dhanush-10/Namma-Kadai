import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NAMMA KADAI — நம்ம கடை', short_name: 'நம்ம கடை', description: 'Smart Shop. Simple Accounts.',
    start_url: '/dashboard', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#faf7f2', theme_color: '#0b6347', lang: 'ta',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Add purchase', url: '/purchase', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Receive payment', url: '/payment', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
