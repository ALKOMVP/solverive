// functions/chat.ts
interface Env {
  AI: any;              // Binding de Workers AI (obligatorio en prod)
  VECTORIZE?: any;      // Binding de Vectorize (opcional)
}

type In = {
  query?: string;
  message?: string;
  text?: string;
  topK?: number;
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  // Métodos permitidos
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Parseo seguro
  let body: In = {};
  try { body = await request.json<In>(); } catch { /* noop */ }

  // Normalización de entrada
  const raw =
    (body.query ?? body.message ?? body.text ?? "").toString().trim().replace(/\s+/g, " ");
  const topK = clampNumber(Number(body.topK ?? 5), 1, 16);

  if (!raw) {
    return json({ error: "Body inválido. Enviá JSON con { query: '...' }" }, 400);
  }

  // Entorno sin AI → aviso (útil en dev)
  if (!env.AI) {
    return json({
      answer:
        "⚠️ Modo local sin Workers AI. Corré `npm run build && npm run cf:dev` y/o configurá bindings AI / VECTORIZE. La ruta /chat responde OK.",
      mode: "no-ai",
      confidence: 0,
      confidenceLabel: "bajo",
      sources: [],
      modelUsed: null,
      suggestions: ["Probar en producción", "Configurar AI y VECTORIZE"],
    });
  }

  // ---------------------------
  // 1) RAG (opcional y NO bloqueante)
  // ---------------------------
  let matches: any[] = [];
  let contextBlocks: string[] = [];
  let confidence = 0;
  let mode: "rag" | "general" = "general";

  try {
    // Embedding (podés cambiar por un modelo multilingüe si lo activás en tu cuenta)
    const emb = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: raw });
    const queryVec = emb?.data?.[0] ?? emb?.[0];

    if (env.VECTORIZE?.query && Array.isArray(queryVec)) {
      const res = await env.VECTORIZE.query(queryVec, {
        topK,
        returnMetadata: true,
      });
      matches = res?.matches ?? [];

      // Construcción de contexto y cálculo de confianza
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        confidence = Math.max(confidence, Number(m?.score ?? 0));
        const meta = m?.metadata ?? {};
        const text = meta.text ?? meta.excerpt ?? m?.text ?? "";
        const title = meta.title ? `**${meta.title}**\n` : "";
        if (text) contextBlocks.push(`${i + 1}. ${title}${text}`);
      }

      if (contextBlocks.length) mode = "rag";
    }
  } catch {
    // Si RAG falla, seguimos en "general" sin romper la UX
  }

  // Heurística: saludo amable si sólo saludan
  if (mode === "general" && /\b(hola|holis|buenas|hello|hi)\b/i.test(raw)) {
    return json({
      answer:
        "¡Hola! Soy el asistente de Solverive. Puedo ayudarte con servicios, precios, casos y soporte. ¿Sobre qué querés hablar?",
      mode,
      confidence,
      confidenceLabel: label(confidence),
      sources: [],
      modelUsed: "none",
      suggestions: ["Servicios", "Precios", "Implementación", "Casos de uso"],
    });
  }

  // ---------------------------
  // 2) Elección de modelo y prompt
  // ---------------------------
  const needs70b =
    confidence < 0.55 ||
    /resumen|compar(a|ar)|pro(s|s y contras)|estratégico|ejecutivo|roadmap|arquitectura/i.test(
      raw,
    );

  const primaryModel = needs70b
    ? "@cf/meta/llama-3.1-70b-instruct"
    : "@cf/meta/llama-3.1-8b-instruct";

  const systemPrompt = `
Eres un asistente de Solverive. Respondes SIEMPRE en español, claro y profesional.
Si hay CONTEXTO, úsalo para dar respuestas específicas y **cita las fuentes** al final con el formato "Fuentes: [1], [2]".
Si no hay contexto, igual ayuda con conocimiento general y guía práctica. Ofrece próximos pasos cuando tenga sentido.
Sé conciso, evita relleno y no inventes URLs.
`.trim();

  const userPrompt = `
Usuario: ${raw}

${contextBlocks.length ? `CONTEXTO (fragmentos numerados):\n${contextBlocks.join("\n\n")}` : "No hay contexto de base de conocimiento."}
`.trim();

  // ---------------------------
  // 3) Llamada al modelo (con fallback si 70B falla/no está)
  // ---------------------------
  let modelUsed = primaryModel;
  let answer = "";
  try {
    const res = await env.AI.run(primaryModel, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: needs70b ? 0.25 : 0.35,
      max_tokens: needs70b ? 700 : 350,
    });
    answer = (res?.response ?? res?.output_text ?? res?.result?.response ?? "").toString();
  } catch {
    // Fallback a 8B si el 70B no está disponible o rate-limited
    if (primaryModel.includes("70b")) {
      modelUsed = "@cf/meta/llama-3.1-8b-instruct";
      const res = await env.AI.run(modelUsed, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.35,
        max_tokens: 350,
      });
      answer = (res?.response ?? res?.output_text ?? "").toString();
    } else {
      throw new Error("Fallo de inferencia con 8B");
    }
  }

  // Si por algún motivo no vino texto, devolvemos algo digno
  if (!answer) {
    answer =
      "No pude generar respuesta en este momento. Probá de nuevo o contame con un poco más de detalle qué necesitás.";
  }

  return json({
    answer: answer.trim(),
    mode,
    confidence,
    confidenceLabel: label(confidence),
    sources: matches.map((m: any, i: number) => ({
      n: i + 1,
      id: m?.id,
      score: m?.score,
      meta: m?.metadata ?? {},
    })),
    modelUsed,
    suggestions:
      mode === "general"
        ? ["Servicios", "Precios", "Casos de uso", "Implementación"]
        : ["¿Querés que te resuma las fuentes?", "¿Buscamos más documentos?", "¿Generamos próximos pasos?"],
  });
};

// ---------------------------
// Helpers
// ---------------------------
function clampNumber(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function label(score: number) {
  if (score >= 0.75) return "alto";
  if (score >= 0.55) return "medio";
  return "bajo";
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
