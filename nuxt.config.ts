// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],

  // Components are referenced by file name only (no folder prefix)
  components: [{ path: '~/components', pathPrefix: false }],

  experimental: {
    viewTransition: true,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Layra',
      meta: [{ name: 'theme-color', content: '#15803D' }],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },

  // Every value can be overridden at runtime with NUXT_<SNAKE_CASE> env vars (see .env.example)
  runtimeConfig: {
    databaseUrl: '',
    dataDir: './.data',
    migrationsDir: './server/db/migrations',
    limits: {
      maxModelMb: 250,
      warnModelMb: 50,
      maxImageMb: 15,
      maxFilesPerProject: 20,
      maxImagesPerProject: 30,
      storageQuotaGb: 20,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Layra',
      short_name: 'Layra',
      description: 'Proyectos de impresión 3D',
      lang: 'es',
      theme_color: '#15803D',
      background_color: '#F5F7F5',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      // Android: "Share" a MakerWorld link from Chrome / the MakerWorld app straight into Layra
      share_target: {
        action: '/import',
        method: 'GET',
        params: { title: 'title', text: 'text', url: 'url' },
      },
    },
    generateSW: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
    },
    devOptions: { enabled: false },
  },
})
