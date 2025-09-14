// setup.js — Genera el starter Astro + Cloudflare (Pages + Workers AI + Vectorize)
const fs = require('fs');
const path = require('path');

function write(filePath, content = '') {
  const full = path.join(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('✔︎', filePath);
}

// ---------- package / configs ----------
write('package.json', JSON.stringify({
  name: 'solverive-astro',
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    dev: 'astro dev',
    build: 'astro build',
    preview: 'astro preview',
    'cf:dev': 'wrangler pages dev ./dist --compatibility-date=2024-09-14'
  },
  dependencies: {
    astro: '^4.12.0',
    '@astrojs/mdx': '^3.1.0',
    '@astrojs/cloudflare': '^11.0.0',
    '@astrojs/react': '^3.5.0',
    react: '^18.3.1',
    'react-dom': '^18.3.1'
  },
  devDependencies: { typescript: '^5.6.2' }
}, null, 2) + '\n');

write('astro.config.mjs',
"import { defineConfig } from 'astro/config'\n" +
"import cloudflare from '@astrojs/cloudflare'\n" +
"import react from '@astrojs/react'\n" +
"import mdx from '@astrojs/mdx'\n\n" +
"export default defineConfig({\n" +
"  output: 'server', // Pages Functions\n" +
"  adapter: cloudflare({ mode: 'directory' }),\n" +
"  integrations: [react(), mdx()],\n" +
"  site: 'https://solverive.com',\n" +
"})\n"
);

write('tsconfig.json',
"{\n" +
'  "compilerOptions": {\n' +
'    "target": "ES2022",\n' +
'    "module": "ESNext",\n' +
'    "moduleResolution": "Bundler",\n' +
'    "jsx": "react-jsx",\n' +
'    "strict": true,\n' +
'    "types": ["@cloudflare/workers-types", "astro/client"]\n' +
'  }\n' +
"}\n"
);

write('.gitignore', "node_modules\ndist\n.env\n.DS_Store\n");

// ---------- public ----------
write('public/favicon.ico', '');
write('public/og-image.jpg', '');

// ---------- styles ----------
write('src/styles/global.css',
":root{--bg:#0b1020;--bg-alt:#0f1530;--primary:#7c3aed;--secondary:#06b6d4;--text:#e5e7eb;--muted:#b2b7c3;--card:#11162a}\n" +
"*{box-sizing:border-box}\n" +
"body{margin:0;font-family:Inter,system-ui;line-height:1.6;color:var(--text);background:linear-gradient(180deg,var(--bg),var(--bg-alt))}\n" +
"a{color:inherit;text-decoration:none}\n" +
".container{max-width:1100px;margin:0 auto;padding:0 24px}\n" +
".btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(90deg,var(--primary),#9333ea);color:#fff;padding:12px 18px;border-radius:14px;font-weight:700}\n" +
".card{background:var(--card);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:22px}\n" +
"nav{position:sticky;top:0;z-index:20;background:rgba(0,0,0,.2);backdrop-filter:blur(10px)}\n"
);

// ---------- components ----------
write('src/components/Header.astro',
"---\n" +
"const links = [\n" +
"  { href: '/#services', label: 'Services' },\n" +
"  { href: '/#benefits', label: 'Benefits' },\n" +
"  { href: '/blog', label: 'Blog' },\n" +
"  { href: '/docs', label: 'Docs' },\n" +
"  { href: '/#contact', label: 'Contact' },\n" +
"]\n" +
"---\n" +
"<nav>\n" +
"  <div class=\"container\" style=\"display:flex;justify-content:space-between;align-items:center;padding:12px 0;\">\n" +
"    <a href=\"/\" style=\"font-weight:800\">Solverive</a>\n" +
"    <div style=\"display:flex;gap:16px\">\n" +
"      {links.map((l) => <a href={l.href}>{l.label}</a>)}\n" +
"    </div>\n" +
"  </div>\n" +
"</nav>\n"
);

write('src/components/ChatWidget.jsx',
"import { useEffect, useRef, useState } from 'react'\n\n" +
"export default function ChatWidget(){\n" +
"  const [open, setOpen] = useState(false)\n" +
"  const [loading, setLoading] = useState(false)\n" +
"  const [msgs, setMsgs] = useState([])\n" +
"  const inputRef = useRef(null)\n" +
"  const bodyRef = useRef(null)\n\n" +
"  useEffect(()=>{ if(open) inputRef.current?.focus() },[open])\n" +
"  useEffect(()=>{ bodyRef.current && (bodyRef.current.scrollTop = bodyRef.current.scrollHeight) }, [msgs])\n\n" +
"  async function send(e){\n" +
"    e.preventDefault()\n" +
"    const q = inputRef.current.value.trim(); if(!q) return\n" +
"    setMsgs(m=>[...m,{role:'user',content:q}]); inputRef.current.value=''; setLoading(true)\n" +
"    try{\n" +
"      const res = await fetch('/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: q, topK:5 }) })\n" +
"      const data = await res.json()\n" +
"      setMsgs(m=>[...m,{role:'assistant',content:data.answer || 'Sin respuesta'}])\n" +
"    }catch(err){ setMsgs(m=>[...m,{role:'assistant',content:'Error de servidor'}]) }\n" +
"    finally{ setLoading(false) }\n" +
"  }\n\n" +
"  return (\n" +
"    <>\n" +
"      <button className=\"btn\" style={{position:'fixed',right:16,bottom:16,zIndex:40}} onClick={()=>setOpen(v=>!v)}>Chat IA</button>\n" +
"      {open && (\n" +
"        <div style={{position:'fixed',right:16,bottom:74,width:'min(400px,92vw)',maxHeight:'70vh',display:'flex',flexDirection:'column',background:'#0f1530',border:'1px solid rgba(255,255,255,.1)',borderRadius:14,overflow:'hidden',zIndex:40}}>\n" +
"          <div style={{padding:'10px 12px',background:'rgba(255,255,255,.06)',display:'flex',justifyContent:'space-between'}}>\n" +
"            <strong>Solverive Assistant</strong>\n" +
"            <button onClick={()=>setOpen(false)}>✕</button>\n" +
"          </div>\n" +
"          <div ref={bodyRef} style={{padding:12,overflow:'auto',display:'flex',flexDirection:'column',gap:10}}>\n" +
"            {msgs.map((m,i)=> (\n" +
"              <div key={i} style={{alignSelf: m.role==='user'?'flex-end':'flex-start', background: m.role==='user'?'#1b2142':'#11162a', border:'1px solid rgba(255,255,255,.1)', padding:10, borderRadius:10}}>{m.content}</div>\n" +
"            ))}\n" +
"            {loading && <div className=\"card\">Pensando…</div>}\n" +
"          </div>\n" +
"          <form onSubmit={send} style={{display:'flex',gap:8,padding:12,borderTop:'1px solid rgba(255,255,255,.1)'}}>\n" +
"            <input ref={inputRef} placeholder=\"Preguntá sobre la empresa…\" style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,.18)',background:'rgba(255,255,255,.05)',color:'#e5e7eb'}} />\n" +
"            <button className=\"btn\" type=\"submit\">Enviar</button>\n" +
"          </form>\n" +
"        </div>\n" +
"      )}\n" +
"    </>\n" +
"  )\n" +
"}\n"
);

// ---------- content collections ----------
write('src/content/config.ts',
"import { defineCollection, z } from 'astro:content'\n\n" +
"const blog = defineCollection({\n" +
"  type: 'content',\n" +
"  schema: z.object({\n" +
"    title: z.string(),\n" +
"    description: z.string().optional(),\n" +
"    date: z.date(),\n" +
"    tags: z.array(z.string()).optional(),\n" +
"    draft: z.boolean().default(false)\n" +
"  })\n" +
"})\n\n" +
"const docs = defineCollection({\n" +
"  type: 'content',\n" +
"  schema: z.object({\n" +
"    title: z.string(),\n" +
"    order: z.number().default(0),\n" +
"    description: z.string().optional()\n" +
"  })\n" +
"})\n\n" +
"export const collections = { blog, docs }\n"
);

// ---------- pages ----------
write('src/pages/index.astro',
"---\n" +
"import '../styles/global.css'\n" +
"import Header from '../components/Header.astro'\n" +
"import ChatWidget from '../components/ChatWidget.jsx'\n" +
"---\n" +
"<html lang=\"en\">\n" +
"  <head>\n" +
"    <meta charset=\"utf-8\" />\n" +
"    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n" +
"    <title>Solverive | AI Automation & Digital Marketing</title>\n" +
"    <meta name=\"description\" content=\"AI made simple: automation, marketing and advisory.\" />\n" +
"    <link rel=\"icon\" href=\"/favicon.ico\" />\n" +
"  </head>\n" +
"  <body>\n" +
"    <Header />\n" +
"    <header class=\"container\" style=\"padding:80px 0;text-align:center\">\n" +
"      <h1 style=\"font-size:clamp(32px,6vw,56px);margin:0\">Boost your business with <span style=\"background:linear-gradient(90deg,#fff,#d6bcff 60%, #67e8f9);-webkit-background-clip:text;color:transparent\">Solverive AI</span></h1>\n" +
"      <p style=\"color:var(--muted);max-width:680px;margin:14px auto 0\">We make artificial intelligence simple and effective for companies of all sizes — from smart automation to digital marketing campaigns that drive growth.</p>\n" +
"      <div style=\"display:flex;gap:12px;justify-content:center;margin-top:24px\">\n" +
"        <a class=\"btn\" href=\"#contact\">Get Started</a>\n" +
"        <a class=\"btn\" style=\"background:transparent;border:1px solid rgba(255,255,255,.22)\" href=\"#services\">Learn More</a>\n" +
"      </div>\n" +
"    </header>\n\n" +
"    <section id=\"services\" class=\"container\" style=\"padding:70px 0\">\n" +
"      <div class=\"card\"><h2>Our Services</h2>\n" +
"        <p class=\"muted\">Automation • Digital Marketing • Advisory</p></div>\n" +
"    </section>\n\n" +
"    <section id=\"benefits\" class=\"container\" style=\"padding:70px 0\">\n" +
"      <div class=\"card\"><h2>Why Choose Us</h2>\n" +
"        <ul>\n" +
"          <li>Time Savings</li>\n" +
"          <li>More Reach</li>\n" +
"          <li>Easy Adoption</li>\n" +
"        </ul></div>\n" +
"    </section>\n\n" +
"    <section id=\"contact\" class=\"container\" style=\"padding:70px 0\">\n" +
"      <div class=\"card\">\n" +
"        <h2>Let’s Work Together</h2>\n" +
"        <form name=\"contact\" method=\"POST\" data-netlify=\"true\">\n" +
"          <input type=\"hidden\" name=\"form-name\" value=\"contact\" />\n" +
"          <div style=\"display:grid;gap:12px\">\n" +
"            <input name=\"name\" placeholder=\"Your name\" class=\"input\" />\n" +
"            <input type=\"email\" name=\"email\" placeholder=\"Your email\" class=\"input\" />\n" +
"            <textarea name=\"message\" rows=\"4\" placeholder=\"Tell us about your needs\" class=\"input\"></textarea>\n" +
"            <button class=\"btn\">Send</button>\n" +
"          </div>\n" +
"        </form>\n" +
"      </div>\n" +
"    </section>\n\n" +
"    <ChatWidget client:idle />\n" +
"  </body>\n" +
"</html>\n"
);

write('src/pages/blog/index.astro',
"---\n" +
"import { getCollection } from 'astro:content'\n" +
"const posts = await getCollection('blog', (p)=>!p.data.draft)\n" +
"---\n" +
"<div class=\"container\" style=\"padding:60px 0\">\n" +
"  <h1>Blog</h1>\n" +
"  <ul>\n" +
"    {posts.sort((a,b)=> b.data.date.getTime()-a.data.date.getTime()).map(p => (\n" +
"      <li><a href={'/blog/' + p.slug}>{p.data.title}</a> — {p.data.date.toISOString().slice(0,10)}</li>\n" +
"    ))}\n" +
"  </ul>\n" +
"</div>\n"
);

write('src/pages/blog/[...slug].astro',
"---\n" +
"import { getCollection, getEntryBySlug } from 'astro:content'\n" +
"export async function getStaticPaths(){\n" +
"  const posts = await getCollection('blog')\n" +
"  return posts.map(p=>({ params:{ slug: p.slug } }))\n" +
"}\n" +
"const { slug } = Astro.params\n" +
"const post = await getEntryBySlug('blog', slug)\n" +
"if(!post) throw new Error('Not found')\n" +
"const { Content, data } = await post.render()\n" +
"---\n" +
"<div class=\"container\" style=\"padding:60px 0\">\n" +
"  <h1>{data.title}</h1>\n" +
"  <p style=\"color:var(--muted)\">{data.date.toISOString().slice(0,10)}</p>\n" +
"  <article class=\"card\"><Content /></article>\n" +
"</div>\n"
);

write('src/content/blog/2025-09-14-welcome.md',
"---\n" +
"title: \"Welcome to Solverive Blog\"\n" +
"description: \"News, tips and case studies about AI for growth\"\n" +
"date: 2025-09-14\n" +
"tags: [ai, automation]\n" +
"---\n" +
"We will share practical insights about AI automation and digital marketing.\n"
);

write('src/pages/docs/index.astro',
"---\n" +
"import { getCollection } from 'astro:content'\n" +
"const pages = await getCollection('docs')\n" +
"---\n" +
"<div class=\"container\" style=\"padding:60px 0\">\n" +
"  <h1>Docs</h1>\n" +
"  <ul>\n" +
"    {pages.sort((a,b)=> a.data.order-b.data.order).map(p => (\n" +
"      <li><a href={'/docs/' + p.slug}>{p.data.title}</a></li>\n" +
"    ))}\n" +
"  </ul>\n" +
"</div>\n"
);

write('src/pages/docs/[...slug].astro',
"---\n" +
"import { getEntryBySlug } from 'astro:content'\n" +
"export function getStaticPaths(){ return [] }\n" +
"const { slug } = Astro.params\n" +
"const page = await getEntryBySlug('docs', slug)\n" +
"if(!page) throw new Error('Not found')\n" +
"const { Content, data } = await page.render()\n" +
"---\n" +
"<div class=\"container\" style=\"padding:60px 0\">\n" +
"  <h1>{data.title}</h1>\n" +
"  <article class=\"card\"><Content /></article>\n" +
"</div>\n"
);

write('src/content/docs/getting-started.md',
"---\n" +
"title: Getting Started\n" +
"order: 1\n" +
"description: How to use Solverive resources\n" +
"---\n" +
"Welcome to the docs! This is a starter page.\n"
);

// ---------- Pages Functions (APIs) ----------
write('functions/chat.ts',
"export const onRequestPost: PagesFunction = async ({ request, env }) => {\n" +
"  const { query, topK = 5 } = await request.json()\n" +
"  if(!query) return new Response('Missing query', { status: 400 })\n\n" +
"  // 1) Embedding de la consulta\n" +
"  const emb = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] })\n" +
"  const qv = (emb.data ?? emb)[0]\n\n" +
"  // 2) Búsqueda semántica en Vectorize\n" +
"  const res = await env.VECTORIZE.query(qv, { topK, returnMetadata: true })\n" +
"  const matches = res.matches || []\n\n" +
"  // 3) Construir contexto + score simple\n" +
"  let confidence = 0\n" +
"  const context = matches.map((m,i)=>{\n" +
"    confidence = Math.max(confidence, m.score || 0)\n" +
"    const ex = m.metadata?.excerpt || ''\n" +
"    const title = m.metadata?.title ? ('Title: ' + m.metadata.title + '\\n') : ''\n" +
"    return '### Doc ' + (i+1) + '\\n' + title + ex\n" +
"  }).join('\\n\\n')\n\n" +
"  const use70 = confidence < 0.55 || /resumen|compar(a|ar)|pro(s|s y contras)|estratégico|ejecutivo/i.test(query)\n" +
"  const model = use70 ? '@cf/meta/llama-3.1-70b-instruct' : '@cf/meta/llama-3.1-8b-instruct'\n\n" +
"  const sys = 'Eres asistente de Solverive. Responde en español y cita fuentes del CONTEXTO. Si falta info, dilo.'\n" +
"  const user = 'Pregunta: ' + query + '\\n\\nCONTEXTO:\\n' + (context || '(no hay resultados relevantes)')\n\n" +
"  const aiRes = await env.AI.run(model, { messages: [ {role:'system', content: sys}, {role:'user', content: user} ], temperature: 0.25, max_tokens: use70?600:280 })\n\n" +
"  return Response.json({ answer: aiRes.response || aiRes, confidence, sources: matches.map(m=>({ id:m.id, meta:m.metadata })) })\n" +
"}\n"
);

write('functions/embed.ts',
"// Ingesta de documentos en lotes: { docs: [{id, text, meta}], upsert?: boolean }\n" +
"export const onRequestPost: PagesFunction = async ({ request, env }) => {\n" +
"  const { docs = [], upsert = true } = await request.json()\n" +
"  if(!docs.length) return new Response('No docs', { status: 400 })\n\n" +
"  // 1) Embeddings por lotes\n" +
"  const texts = docs.map(d=> d.text)\n" +
"  const res = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: texts })\n" +
"  const vectors = res.data ?? res\n\n" +
"  // 2) Upsert en Vectorize\n" +
"  const points = vectors.map((vec, i) => ({ id: docs[i].id || crypto.randomUUID(), values: vec, metadata: docs[i].meta || {} }))\n" +
"  await env.VECTORIZE.upsert(points)\n\n" +
"  return Response.json({ indexed: points.length })\n" +
"}\n"
);

console.log('\n✅ Proyecto generado. Siguientes pasos:');
console.log('1) npm install');
console.log('2) npm run dev');
console.log('3) Deploy en Cloudflare Pages y configurar bindings: AI y VECTORIZE');
