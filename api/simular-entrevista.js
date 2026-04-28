const Anthropic = require('@anthropic-ai/sdk');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { usuarioId, respuesta, historial } = req.body;
  if (!usuarioId) return res.status(400).json({ error: 'usuarioId requerido' });

  try {
    // Verificar que tiene acceso a entrevista
    const pagoRaw = await redis.get(`descarga:${usuarioId}`);
    if (!pagoRaw) return res.status(403).json({ error: 'Sin acceso a simulación de entrevista' });
    const pago = typeof pagoRaw === 'string' ? JSON.parse(pagoRaw) : pagoRaw;
    if (!pago.entrevista) return res.status(403).json({ error: 'Plan sin simulación de entrevista' });

    // Recuperar CV del usuario
    const cvRaw = await redis.get(`cv:pagado:${usuarioId}`) || await redis.get(`cv:usuario:${usuarioId}`);
    if (!cvRaw) return res.status(404).json({ error: 'CV no encontrado' });
    const cvData = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;
    const cv = cvData.cvData || cvData;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Primera pregunta — iniciar entrevista
    if (!historial || historial.length === 0) {
      const prompt = `Eres un entrevistador profesional peruano experto en recursos humanos. 
Vas a simular una entrevista de trabajo real para el candidato con este perfil:

PUESTO AL QUE POSTULA: ${cv.cargo || 'No especificado'}
NOMBRE: ${cv.nombre}
PERFIL: ${cv.perfil || ''}
EXPERIENCIA: ${(cv.experiencia || []).map(e => `${e.cargo} en ${e.empresa} (${e.periodo})`).join(', ')}
EDUCACIÓN: ${(cv.educacion || []).map(e => `${e.titulo} en ${e.institucion}`).join(', ')}

INSTRUCCIONES:
- Haz UNA sola pregunta por turno
- Adapta las preguntas según las respuestas del candidato
- Mezcla preguntas técnicas del puesto, conductuales basadas en su CV, y psicológicas
- Sé profesional pero amable — como un entrevistador peruano real
- Después de cada respuesta, da un feedback breve (1-2 líneas) antes de la siguiente pregunta
- Después de 7 preguntas, da un resumen final con fortalezas y áreas de mejora

Empieza con: "Buenos días [nombre]. Gracias por tu tiempo. Para comenzar, ¿podrías contarme un poco sobre ti y por qué te interesa este puesto de [cargo]?"

Responde SOLO con JSON:
{
  "pregunta": "texto de la pregunta",
  "feedback": null,
  "numeroPreguntas": 1,
  "finalizado": false
}`;

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });

      const texto = msg.content[0].text.replace(/```json|```/g, '').trim();
      return res.json(JSON.parse(texto));
    }

    // Preguntas siguientes — con historial
    const numeroPreguntas = Math.floor(historial.length / 2) + 1;
    const finalizar = numeroPreguntas >= 7;

    const prompt = `Eres un entrevistador profesional peruano.

PUESTO: ${cv.cargo || 'No especificado'}
CANDIDATO: ${cv.nombre}
PERFIL: ${cv.perfil || ''}
EXPERIENCIA: ${(cv.experiencia || []).map(e => `${e.cargo} en ${e.empresa}`).join(', ')}

HISTORIAL DE LA ENTREVISTA:
${historial.map((h, i) => `${i % 2 === 0 ? 'Entrevistador' : 'Candidato'}: ${h}`).join('\n')}

ÚLTIMA RESPUESTA DEL CANDIDATO: "${respuesta}"

${finalizar ? 
`Esta fue la última pregunta. Da un resumen final profesional con:
- Fortalezas demostradas en la entrevista
- Áreas de mejora
- Recomendación general

Responde con JSON:
{
  "pregunta": null,
  "feedback": "resumen final completo aquí",
  "numeroPreguntas": ${numeroPreguntas},
  "finalizado": true
}` :
`Evalúa brevemente la respuesta (1-2 líneas de feedback) y haz la siguiente pregunta adaptada.
Las preguntas deben alternar entre: técnicas del puesto, conductuales basadas en su CV real, y psicológicas.
Pregunta ${numeroPreguntas} de 7.

Responde SOLO con JSON:
{
  "pregunta": "siguiente pregunta aquí",
  "feedback": "feedback breve de la respuesta anterior",
  "numeroPreguntas": ${numeroPreguntas},
  "finalizado": false
}`}`;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    const texto = msg.content[0].text.replace(/```json|```/g, '').trim();
    return res.json(JSON.parse(texto));

  } catch (error) {
    console.error('Error simulación entrevista:', error.message);
    res.status(500).json({ error: error.message });
  }
};
