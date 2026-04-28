const Anthropic = require('@anthropic-ai/sdk');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { usuarioId, respuesta, historial, puestoManual } = req.body;
  if (!usuarioId) return res.status(400).json({ error: 'usuarioId requerido' });

  try {
    // Verificar acceso
    const pagoRaw = await redis.get(`descarga:${usuarioId}`);
    if (!pagoRaw) return res.status(403).json({ error: 'Sin acceso a simulación de entrevista' });
    const pago = typeof pagoRaw === 'string' ? JSON.parse(pagoRaw) : pagoRaw;
    if (!pago.entrevista) return res.status(403).json({ error: 'Plan sin simulación de entrevista' });

    // Verificar límite de 2 intentos
    const intentosKey = `entrevista:intentos:${usuarioId}`;
    const intentos = parseInt(await redis.get(intentosKey) || '0');
    if (intentos >= 2 && (!historial || historial.length === 0)) {
      return res.status(429).json({
        error: 'Ya usaste tus 2 simulaciones disponibles.',
        agotado: true
      });
    }

    // Recuperar CV
    const cvRaw = await redis.get(`cv:pagado:${usuarioId}`) || await redis.get(`cv:usuario:${usuarioId}`);
    if (!cvRaw) return res.status(404).json({ error: 'CV no encontrado' });
    const cvData = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;
    const cv = cvData.cvData || cvData;
    const oferta = cvData.oferta || '';

    // Jerarquía: oferta > puesto manual > cargo del CV > cargo del primer trabajo
    const tieneOferta = oferta && oferta.trim().length > 50;
    const puesto = tieneOferta
      ? null
      : puestoManual || cv.cargo || (cv.experiencia?.[0]?.cargo) || null;

    // Si no hay oferta ni puesto → pedir puesto al frontend
    if (!tieneOferta && !puesto && (!historial || historial.length === 0)) {
      return res.json({
        necesitaPuesto: true,
        mensaje: 'Para una simulación más precisa, ¿a qué puesto postulas?'
      });
    }

    const contextoPuesto = tieneOferta
      ? `OFERTA DE TRABAJO:\n${oferta}`
      : puesto
      ? `PUESTO AL QUE POSTULA: ${puesto}`
      : 'Sin puesto específico — preguntas generales de RRHH';

    const perfilCandidato = `
NOMBRE: ${cv.nombre || 'el candidato'}
${contextoPuesto}
EXPERIENCIA: ${(cv.experiencia || []).map(e => `${e.cargo} en ${e.empresa} (${e.periodo || ''})`).join(' | ')}
EDUCACIÓN: ${(cv.educacion || []).map(e => `${e.titulo} en ${e.institucion}`).join(' | ')}
HABILIDADES: ${(cvData.habilidades || []).map(h => h.nombre || h).join(', ')}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Primera pregunta
    if (!historial || historial.length === 0) {
      await redis.setex(intentosKey, 60 * 60 * 24 * 30, String(intentos + 1));

      const prompt = `Eres un entrevistador profesional peruano de recursos humanos.
Compórtate exactamente como un reclutador real en una entrevista de trabajo.
NUNCA des feedback, NUNCA digas "buena respuesta", "excelente" o similares.
Solo haz preguntas naturales como lo haría un reclutador peruano profesional.

PERFIL DEL CANDIDATO:
${perfilCandidato}

INSTRUCCIONES:
- Haz UNA sola pregunta por turno
- Adapta cada pregunta según las respuestas del candidato
- Mezcla: técnicas del puesto, conductuales basadas en su CV, situacionales, psicológicas
- Incluye preguntas típicas: pretensión salarial, disponibilidad, por qué dejó trabajos anteriores
- Tono profesional y amable — empresa peruana seria
- Sin feedback ni evaluación durante la entrevista — solo al final

Comienza con un saludo natural y la primera pregunta.

Responde SOLO con JSON:
{
  "pregunta": "saludo + primera pregunta",
  "numeroPreguntas": 1,
  "finalizado": false,
  "intentosRestantes": ${2 - (intentos + 1)}
}`;

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      });

      const texto = msg.content[0].text.replace(/```json|```/g, '').trim();
      return res.json(JSON.parse(texto));
    }

    // Preguntas siguientes
    const numeroPreguntas = Math.floor(historial.length / 2) + 1;
    const finalizar = numeroPreguntas >= 7;

    const historialTexto = historial.map((h, i) =>
      `${i % 2 === 0 ? 'Entrevistador' : 'Candidato'}: ${h}`
    ).join('\n');

    const prompt = finalizar ?
`Eres un evaluador profesional de RRHH peruano.
Acabas de entrevistar a este candidato:
${perfilCandidato}

HISTORIAL COMPLETO:
${historialTexto}
ÚLTIMA RESPUESTA: "${respuesta}"

Genera evaluación final profesional. Sé específico y accionable.

Responde SOLO con JSON:
{
  "pregunta": null,
  "finalizado": true,
  "numeroPreguntas": 7,
  "resumen": {
    "calificacionGeneral": 0,
    "fortalezas": ["fortaleza específica 1", "fortaleza específica 2", "fortaleza específica 3"],
    "areasMejora": ["área de mejora concreta 1", "área de mejora concreta 2"],
    "recomendacionFinal": "recomendación accionable de 2-3 líneas para mejorar en próximas entrevistas",
    "calificacionPorPregunta": [
      {"numero": 1, "estrellas": 0, "comentario": "comentario breve específico"},
      {"numero": 2, "estrellas": 0, "comentario": "comentario breve específico"},
      {"numero": 3, "estrellas": 0, "comentario": "comentario breve específico"},
      {"numero": 4, "estrellas": 0, "comentario": "comentario breve específico"},
      {"numero": 5, "estrellas": 0, "comentario": "comentario breve específico"},
      {"numero": 6, "estrellas": 0, "comentario": "comentario breve específico"},
      {"numero": 7, "estrellas": 0, "comentario": "comentario breve específico"}
    ]
  }
}` :
`Eres un entrevistador profesional peruano. Compórtate como reclutador real.
NO des feedback. NO evalúes. NO digas "buena respuesta". Solo pregunta.

PERFIL:
${perfilCandidato}

HISTORIAL:
${historialTexto}
ÚLTIMA RESPUESTA: "${respuesta}"

Haz la pregunta ${numeroPreguntas} de 7 de forma natural y adaptada al candidato.

Responde SOLO con JSON:
{
  "pregunta": "siguiente pregunta natural",
  "numeroPreguntas": ${numeroPreguntas},
  "finalizado": false
}`;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: finalizar ? 1200 : 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const texto = msg.content[0].text.replace(/```json|```/g, '').trim();
    return res.json(JSON.parse(texto));

  } catch (error) {
    console.error('Error simulación entrevista:', error.message);
    res.status(500).json({ error: error.message });
  }
};
