import { defineConfig } from 'vite';

/* Build pensado para entregar: un solo archivo HTML autocontenido.
   - base './'        -> rutas relativas, funciona desde cualquier carpeta
   - format 'iife'    -> NO es un modulo ES, asi que abre con doble clic
                         (los <script type="module"> los bloquea file://)
   - assetsInlineLimit alto -> mete cualquier asset dentro del bundle    */
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'juego.js',
        assetFileNames: 'juego.[ext]',
      },
    },
  },
});
