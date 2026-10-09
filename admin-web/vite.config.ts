import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { homeDescription, homeTitle } from './src/home/site'
import { farmDescription, farmTitle } from './src/cloudfarm/site'
import { workDescription, workTitle } from './src/work/site'

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'xiangqiao-site-metadata',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const transformed = mode === 'api-site'
          ? html.replace('src="/src/main.tsx"', 'src="/src/openapi/main.tsx"').replace(/<title>[^<]*<\/title>/, '<title>乡桥API开放平台 · api.nong.cloud</title>').replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/, '<meta name="description" content="乡桥API开放平台 · 接口文档、接入应用与本地调试沙箱" />')
          : mode === 'admin-site'
            ? html.replace('src="/src/main.tsx"', 'src="/src/app/admin-main.tsx"')
          : mode === 'work-site'
            ? html.replace('src="/src/main.tsx"', 'src="/src/work/main.tsx"').replace(/<title>[^<]*<\/title>/, `<title>${workTitle}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/, `<meta name="description" content="${workDescription}" />`)
          : mode === 'farm-site'
            ? html.replace('src="/src/main.tsx"', 'src="/src/cloudfarm/main.tsx"').replace(/<title>[^<]*<\/title>/, `<title>${farmTitle}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/, `<meta name="description" content="${farmDescription}" />`)
          : mode === 'home-site'
            ? html.replace('src="/src/main.tsx"', 'src="/src/home/main.tsx"').replace(/<title>[^<]*<\/title>/, `<title>${homeTitle}</title>`).replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/, `<meta name="description" content="${homeDescription}" />`)
            : html
        return transformed
      },
    },
  }],
  server: { port: 4173, proxy: { '/api/v1': { target: 'http://127.0.0.1:8080', changeOrigin: false } } },
}))
