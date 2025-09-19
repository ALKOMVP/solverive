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

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Parseo seguro
  let body: In = {};
  try { body = await request.json<In>(); } catch { /* noop */ }

  // Normalización de entrada
  const raw = (body.query ?? body.message ?? body.text ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ");
  const topK = clampNumber(Number(body.topK ?? 6), 1, 16);

  if (!raw) {
    return json({ error: "Body inválido. Enviá JSON con { query: '...' }" }, 400);
  }

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
  const RAG_MIN_SCORE = 0.60;
  const RAG_STRICT_SCORE = 0.70;
  const MAX_CONTEXT_CHARS = 1800;

  let matches: any[] = [];
  let contextBlocks: string[] = [];
  let confidence = 0;
  let mode: "rag" | "general" = "general";
  let ragDebug: any = {};

  try {
    // IMPORTANT: índice actual = 768 dims → usamos bge-base-en-v1.5
    const emb = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [raw] });
    const queryVec = emb?.data?.[0];
    if (!Array.isArray(queryVec)) throw new Error("embedding_empty");

    if (env.VECTORIZE?.query) {
      const res = await env.VECTORIZE.query(queryVec, {
        topK,
        returnMetadata: true,
        includeVectors: false,
        returnValues: false,
        // filter: { type: "faq" }, // solo FAQs
      });

      matches = (res?.matches ?? []).sort(
        (a: any, b: any) => (b?.score ?? 0) - (a?.score ?? 0),
      );

      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const score = Number(m?.score ?? 0);
        confidence = Math.max(confidence, score);
        if (score < RAG_MIN_SCORE) continue;

        const meta = m?.metadata ?? {};
        const text = (meta.text ?? meta.excerpt ?? m?.text ?? "").toString();
        if (!text) continue;

        const title = meta.title ? `**${meta.title}**\n` : "";
        contextBlocks.push(`${i + 1}. ${title}${text}`.trim());
      }

      contextBlocks = dedupeByText(contextBlocks).slice(0, 5);
      if (contextBlocks.length) mode = "rag";
      else ragDebug.noContextAfterFilter = { topK, got: matches.length };
    } else {
      ragDebug.vectorize = "missing_query_fn_or_binding";
    }
  } catch (e: any) {
    ragDebug.error = String(e?.message ?? e);
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
    /resumen|compar(a|ar)|pro(s|s y contras)|estratégico|ejecutivo|roadmap|arquitectura/i.test(raw);

  const primaryModel = needs70b
    ? "@cf/meta/llama-3.1-70b-instruct"
    : "@cf/meta/llama-3.1-8b-instruct";

  const ragIsStrict = mode === "rag" && confidence >= RAG_STRICT_SCORE;

  const systemPrompt = buildSystemPrompt(ragIsStrict);

  const joinedContext = contextBlocks.join("\n\n");
  const contextTrimmed =
    joinedContext.length > MAX_CONTEXT_CHARS
      ? joinedContext.slice(0, MAX_CONTEXT_CHARS) + "\n…"
      : joinedContext;

  const userPrompt = `
Usuario: ${raw}

${contextBlocks.length ? `CONTEXTO (fragmentos numerados):\n${contextTrimmed}` : "No hay contexto de base de conocimiento."}
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
      temperature: ragIsStrict ? 0.2 : (needs70b ? 0.25 : 0.35),
      max_tokens: needs70b ? 700 : 380,
      top_p: 0.9,
    });
    answer = (res?.response ?? res?.output_text ?? res?.result?.response ?? "").toString();
  } catch {
    if (primaryModel.includes("70b")) {
      modelUsed = "@cf/meta/llama-3.1-8b-instruct";
      const res = await env.AI.run(modelUsed, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: ragIsStrict ? 0.2 : 0.35,
        max_tokens: 380,
        top_p: 0.9,
      });
      answer = (res?.response ?? res?.output_text ?? "").toString();
    } else {
      answer = "";
    }
  }

  if (!answer) {
    answer =
      "No pude generar respuesta en este momento. Probá de nuevo o contame con un poco más de detalle qué necesitás.";
  }

  const cited = matches
    .filter((m: any) => Number(m?.score ?? 0) >= RAG_MIN_SCORE)
    .slice(0, contextBlocks.length);

  if (contextBlocks.length && !/Fuentes\s*:/i.test(answer)) {
    const numeritos = cited.map((_, i) => `[${i + 1}]`).join(", ");
    answer = `${answer.trim()}\n\nFuentes: ${numeritos}`;
  }

  return json({
    answer: answer.trim(),
    mode,
    confidence,
    confidenceLabel: label(confidence),
    sources: cited.map((m: any, i: number) => ({
      n: i + 1,
      id: m?.id,
      score: m?.score,
      meta: m?.metadata ?? {},
    })),
    modelUsed,
    ragDebug,
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

function dedupeByText(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

function buildSystemPrompt(ragOnly: boolean) {
  if (ragOnly) {
    return [
      "Eres un asistente de Solverive. Respondes SIEMPRE en español, claro y profesional.",
      "Debes responder SOLO usando la información del CONTEXTO.",
      "Si algo no está en el CONTEXTO, di: 'No tengo información precisa en mis fuentes para responder eso por ahora.'",
      "Cita las fuentes al final con el formato 'Fuentes: [1], [2]'.",
      "Sé conciso, evita relleno y no inventes URLs.",
    ].join(" ");
  }
  return [
    "Eres un asistente de Solverive. Respondes SIEMPRE en español, claro y profesional.",
    "Si hay CONTEXTO, úsalo y cita las fuentes al final con el formato 'Fuentes: [1], [2]'.",
    "Si no hay contexto suficiente, podés ayudar con conocimiento general y guías prácticas, evitando alucinaciones e invenciones.",
    "Da próximos pasos accionables cuando tenga sentido. Sé conciso y no inventes URLs.",
  ].join(" ");
}
