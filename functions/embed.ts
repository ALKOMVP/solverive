// Ingesta de documentos en lotes: { docs: [{id, text, meta}], upsert?: boolean }
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const { docs = [], upsert = true } = await request.json()
  if(!docs.length) return new Response('No docs', { status: 400 })

  // 1) Embeddings por lotes
  const texts = docs.map(d=> d.text)
  const res = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: texts })
  const vectors = res.data ?? res

  // 2) Upsert en Vectorize
  const points = vectors.map((vec, i) => ({ id: docs[i].id || crypto.randomUUID(), values: vec, metadata: docs[i].meta || {} }))
  await env.VECTORIZE.upsert(points)

  return Response.json({ indexed: points.length })
}
