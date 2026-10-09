import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root, base:'/',
  build:{outDir:path.join(root,'dist'),emptyOutDir:true,
    rollupOptions:{input:{biblioteca:path.join(root,'index.html'),admin:path.join(root,'admin.html')}}}
});