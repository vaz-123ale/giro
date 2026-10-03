import {defineConfig} from 'vite';

// Desenvolvimento local: só 127.0.0.1; a API local (server/index.ts) atende /api.
export default defineConfig({
 server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:3001',changeOrigin:false}}},
 preview:{host:'127.0.0.1',port:4173,strictPort:true},
});
