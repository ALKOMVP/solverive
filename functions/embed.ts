// functions/embed.ts
// Ingesta (upsert) de FAQs u otros docs en Vectorize.
// Requiere bindings: AI (Workers AI) y VECTORIZE (Vectorize index)

export const onRequest: PagesFunction = async ({ request, env }) => {
  try {
    // 0) FAQs de seed (10)
    const SEED_FAQS = [
      {
        id: "faq-001",
        text:
          "P: ¿Qué hace exactamente su solución de chatbots?\n" +
          "R: Diseñamos e implementamos chatbots personalizados que responden con la voz de tu marca usando RAG, conectados a tus fuentes (docs, web, CRM) y desplegados en tu web, app o WhatsApp.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-002",
        text:
          "P: ¿Cómo cargo mi contenido para que el bot responda con precisión?\n" +
          "R: Puedes subir PDFs/Markdown/URLs o conectar Google Drive y Notion. Indexamos el contenido en un store vectorial y el bot responde citando esas fuentes.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-003",
        text:
          "P: ¿El bot puede mantener el tono de mi marca?\n" +
          "R: Sí. Definimos instrucciones de estilo y límites de respuesta. Además puedes cargar guías de voz y FAQs para reforzar el tono.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-004",
        text:
          "P: ¿Qué tan seguro es el manejo de mis datos?\n" +
          "R: Los datos se almacenan cifrados en tránsito y en reposo. No usamos tu información para entrenar modelos públicos y puedes eliminar tus índices cuando quieras.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-005",
        text:
          "P: ¿Cuánto demora en estar listo un chatbot?\n" +
          "R: Un MVP funcional suele estar en 24–72 horas según el volumen de contenido y las integraciones requeridas.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-006",
        text:
          "P: ¿Con qué canales se integra?\n" +
          "R: Web widget, WhatsApp, Facebook, Intercom y API REST. También podemos automatizar workflows con Zapier/Make.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-007",
        text:
          "P: ¿Qué idiomas soporta?\n" +
          "R: Español, inglés y portugués por defecto. Podemos habilitar más idiomas bajo demanda.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-008",
        text:
          "P: ¿Puedo ver métricas y entrenar mejoras?\n" +
          "R: Sí. Ofrecemos panel con conversaciones, satisfacción, tasa de derivación y gaps de conocimiento para agregar nuevas fuentes y FAQs.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-009",
        text:
          "P: ¿Cómo se maneja la handoff a humano?\n" +
          "R: El bot detecta intención de escalamiento y deriva a tu canal de soporte (email, WhatsApp, Help Desk) con el contexto de la conversación.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
      {
        id: "faq-010",
        text:
          "P: ¿Cuál es el modelo de precios?\n" +
          "R: Plan base mensual por bot + uso por volumen de mensajes. Ofrecemos prueba gratuita y planes personalizados para empresas.",
        meta: { type: "faq", lang: "es", product: "chatbots_custom" },
      },
    ];

    const url = new URL(request.url);
    const seed = url.searchParams.get("seed") === "1";

    // 1) Parseo seguro del body (no rompe si viene vacío)
    let docs: Array<{ id?: string; text: string; meta?: Record<string, any> }> = [];
    try {
      if (request.method === "POST" && request.headers.get("content-type")?.includes("application/json")) {
        const b = await request.json<any>();
        if (Array.isArray(b?.docs)) docs = b.docs;
      }
    } catch {
      // ignoramos body inválido
    }

    if (seed || docs.length === 0) docs = SEED_FAQS;
    if (!docs.length) return j({ error: "No docs. Usa ?seed=1 o manda { docs:[...] }" }, 400);

    // 2) Validaciones de bindings
    if (!env?.AI) return j({ error: "AI binding missing" }, 500);
    if (!env?.VECTORIZE?.upsert) return j({ error: "VECTORIZE binding missing/invalid" }, 500);

    // 3) Embeddings por lote
    const texts = docs.map((d) => d.text);
    // ⚠️ Índice de 768 dimensiones → usa bge-base-en-v1.5
    //    Si tu índice fuera de 1024 dims, cambia a "@cf/baai/bge-m3".
    const emb = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: texts });
    const vectors: number[][] = emb?.data ?? [];
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      return j({ error: "embedding_failed", detail: { got: vectors?.length ?? 0, expected: texts.length } }, 500);
    }

    // 4) Upsert (guardamos también el texto en metadata.text)
    const points = vectors.map((vec, i) => ({
      id: docs[i].id ?? crypto.randomUUID(),
      values: vec,
      metadata: { ...(docs[i].meta ?? {}), text: docs[i].text },
    }));

    const up = await env.VECTORIZE.upsert(points);
    return j({ indexed: points.length, seed, upsert: up });
  } catch (err: any) {
    return j({ error: "embed_failed", message: String(err?.message ?? err) }, 500);
  }
};

function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
