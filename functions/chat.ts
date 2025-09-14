// functions/chat.ts
export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Parseo seguro del body
    let payload: any = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }
    const query = payload?.query?.toString?.() ?? '';
    const topK = Number(payload?.topK ?? 5);

    if (!query) {
      return Response.json(
        { error: "Body inválido. Enviá { query: '...' } como JSON." },
        { status: 400 }
      );
    }

    // ⚠️ En dev local podés no tener bindings → devolver aviso
    if (!env.AI) {
      return Response.json({
        answer:
          "⚠️ Modo local sin Workers AI. Corré `npm run build && npm run cf:dev` y/o configurá bindings AI / VECTORIZE. La ruta /chat está OK.",
        confidence: 0,
        sources: [],
      });
    }

    // 1) Embedding de la consulta
    const emb = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
    const qv = (emb.data ?? emb)[0];

    // 2) Búsqueda en Vectorize (opcional en local)
    let matches: any[] = [];
    if (env.VECTORIZE?.query) {
      try {
        const res = await env.VECTORIZE.query(qv, { topK, returnMetadata: true });
        matches = res.matches || [];
      } catch {
        // sin contexto
      }
    }

    // 3) Contexto + elección de modelo
    let confidence = 0;
    const context = matches
      .map((m: any, i: number) => {
        confidence = Math.max(confidence, m.score || 0);
        const ex = m.metadata?.excerpt || '';
        const title = m.metadata?.title ? `Title: ${m.metadata.title}\n` : '';
        return `### Doc ${i + 1}\n${title}${ex}`;
      })
      .join('\n\n');

    const use70 =
      confidence < 0.55 ||
      /resumen|compar(a|ar)|pro(s|s y contras)|estratégico|ejecutivo/i.test(query);
    const model = use70
      ? '@cf/meta/llama-3.1-70b-instruct'
      : '@cf/meta/llama-3.1-8b-instruct';

    const sys =
      'Eres asistente de Solverive. Responde en español y cita fuentes del CONTEXTO. Si falta info, dilo.';
    const user = `Pregunta: ${query}\n\nCONTEXTO:\n${
      context || '(no hay resultados relevantes)'
    }`;

    const aiRes = await env.AI.run(model, {
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.25,
      max_tokens: use70 ? 600 : 280,
    });

    return Response.json({
      answer: aiRes.response || aiRes,
      confidence,
      sources: matches.map((m: any) => ({ id: m.id, meta: m.metadata })),
    });
  } catch (err: any) {
    return new Response('Server error: ' + (err?.message || String(err)), {
      status: 500,
    });
  }
};
