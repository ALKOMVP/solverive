import { defineConfig } from 'astro/config'
import react from '@astrojs/react' // si usás el ChatWidget

export default defineConfig({
  output: 'static',     // <— importante
  integrations: [react()],
  site: 'https://solverive.com',
})
