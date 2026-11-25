import { createAppleSplashScreens, defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * iPhone launch screens ("splash screens"), generated once into public/ with
 * `npm run generate-splash -w @puzzle-log/web` and committed. iOS shows the one matching the
 * phone's screen size while a home-screen app starts, instead of a blank white screen.
 * The app icons were made separately and aren't regenerated here.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [], favicons: [] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    appleSplashScreens: createAppleSplashScreens(
      {
        // The app's background colors (index.css), light and dark.
        resizeOptions: { background: '#faf8f3', fit: 'contain' },
        darkResizeOptions: { background: '#171412', fit: 'contain' },
        padding: 0.6,
        linkMediaOptions: { log: true, addMediaScreen: true, basePath: '/', xhtml: false },
        png: { compressionLevel: 9, quality: 80 },
      },
      // iPhones from the last several years; older ones just show the background color.
      [
        'iPhone 17 Pro Max',
        'iPhone 17 Pro',
        'iPhone Air',
        'iPhone 17',
        'iPhone 16 Pro Max',
        'iPhone 16 Pro',
        'iPhone 16 Plus',
        'iPhone 16',
        'iPhone 16e',
        'iPhone 15 Pro Max',
        'iPhone 15 Pro',
        'iPhone 14 Plus',
        'iPhone 13',
        'iPhone 13 mini',
        'iPhone 11 Pro Max',
        'iPhone 11',
        'iPhone SE 4.7"',
      ],
    ),
  },
  images: ['pwa-assets/splash-icon.png'],
});
