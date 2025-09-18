// functions/embed.ts
// Ingesta de documentos (FAQs) en Vectorize con opción de "seed".
// Bindings requeridos en Pages → Settings → Functions → Bindings:
//   - Workers AI  → nombre: AI
//   - Vectorize   → nombre: VECTORIZE (apuntando a un índice REAL)

export const onRequest: PagesFunction = async ({ request, env }) => {
  try {
    // --- 0) FAQs de ejemplo (10) ---
    const SEED_FAQS = [
      {
        id: "faq-001",
        text:
          "P: ¿Qué hace exactamente su solución de chatbots?\n" +
          "R: Diseñamos e implementamos chatbots personalizados que responden con la voz de tu marca usando RAG, conectados a tus fuentes (docs, web, CRM) y desplegados en tu web, app o WhatsApp."
      },
      {
        id: "faq-002",
        text:
          "P: ¿Cómo cargo mi contenido para que el bot responda con precisión?\n" +
          "R: Puedes subir PDFs/Markdown/URLs o conectar Google Drive y Notion. Indexamos el contenido en un store vectorial y el bot responde citando esas fuentes."
      },
      {
        id: "faq-003",
        text:
          "P: ¿El bot puede mantener el tono de mi marca?\n" +
          "R: Sí. Definimos instrucciones de estilo y límites de respuesta. Además puedes cargar guías de voz y FAQs para reforzar el tono."
      },
      {
        id: "faq-004",
        text:
          "P: ¿Qué tan seguro es el manejo de mis datos?\n" +
          "R: Los datos se almacenan cifrados en tránsito y en reposo. No usamos tu información para entrenar modelos públicos y puedes eliminar tus índices cuando quieras."
      },
      {
        id: "faq-005",
        text:
          "P: ¿Cuánto demora en estar listo un chatbot?\n" +
          "R: Un MVP funcional suele estar en 24–72 horas según el volumen de contenido y las integraciones requeridas."
      },
      {
        id: "faq-006",
        text:
          "P: ¿Con qué canales se integra?\n" +
          "R: Web widget, WhatsApp, Facebook, Intercom y API REST. También podemos automatizar workflows con Zapier/Make."
      },
      {
        id: "faq-007",
        text:
          "P: ¿Qué idiomas soporta?\n" +
          "R: Español, inglés y portugués por defecto. Podemos habilitar más idiomas bajo demanda."
      },
      {
        id: "faq-008",
        text:
          "P: ¿Puedo ver métricas y entrenar mejoras?\n" +
          "R: Sí. Ofrecemos panel con conversaciones, satisfacción, tasa de derivación y gaps de conocimiento para agregar nuevas fuentes y FAQs."
      },
      {
        id: "faq-009",
        text:
          "P: ¿Cómo se maneja la handoff a humano?\n" +
          "R: El bot detecta intención de escalamiento y deriva a tu canal de soporte (email, WhatsApp, Help Desk) con el contexto de la conversación."
      },
      {
        id: "faq-010",
        text:
          "P: ¿Cuál es el modelo de precios?\n" +
          "R: Plan base mensual por bot + uso por volumen de mensajes. Ofrecemos prueba gratuita y planes personalizados para empresas."
      }
    ].map((d) => ({
      ...d,
      meta: { type: "faq", lang: "es", product: "chatbots_custom" }
    }));

    // --- 1) Modo seed + body seguro ---
    const url = new URL(request.url);
    const seed = url.searchParams.get("seed") === "1";

    // Leemos texto CRUDO (no rompe si no hay body)
    let raw = "";
    if (request.method === "POST") {
      try { raw = await request.text(); } catch { /* sin body → "" */ }
    }

    // Parseamos JSON solo si hay texto y content-type parece JSON
    let body: any = {};
    const isJson = (request.headers.get("content-type") || "").includes("application/json");
    if (raw && isJson) {
      try { body = JSON.parse(raw); } catch { /* JSON inválido → ignoramos */ }
    }

    let docs: Array<{ id?: string; text: string; meta?: Record<string, any> }> =
      Array.isArray(body?.docs) ? body.docs : [];

    if (seed || docs.length === 0) {
      docs = SEED_FAQS;
    }
    if (!docs.length) {
      return j({ error: "No docs. Usa ?seed=1 o manda { docs: [...] }" }, 400);
    }

    // --- 2) Validaciones de bindings ---
    if (!env?.AI) return j({ error: "AI binding missing" }, 500);
    if (!env?.VECTORIZE?.upsert) return j({ error: "VECTORIZE binding missing/invalid" }, 500);

    // --- 3) Embeddings por lote ---
    const texts = docs.map((d) => d.text);
    const emb = await env.AI.run("@cf/baai/bge-m3", { text: [raw] });
    const vectors: number[][] = emb?.data ?? [];
    if (!vectors.length) return j({ error: "Embedding model returned empty vectors" }, 500);

    // --- 4) Upsert en Vectorize (guardamos también el texto en metadata.text) ---
    const points = vectors.map((vec, i) => ({
      id: docs[i].id ?? crypto.randomUUID(),
      values: vec,
      metadata: {
        ...(docs[i].meta ?? {}),
        text: docs[i].text
      }
    }));

    const up = await env.VECTORIZE.upsert(points);

    return j({ indexed: points.length, seed, upsert: up });
  } catch (err: any) {
    return j({ error: "embed_failed", message: String(err?.message ?? err) }, 500);
  }
};

// ---------- helpers ----------
function j(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
