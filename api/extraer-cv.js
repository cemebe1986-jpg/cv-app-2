const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { textoCV } = req.body;

    if (!textoCV) {
      return res.status(400).json({ error: 'No se recibió texto' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Extrae la información de este CV y devuelve SOLO un JSON válido sin markdown:

${textoCV}

{
  "nombre": "nombre completo",
  "email": "email",
  "telefono": "teléfono",
  "ciudad": "ciudad",
  "experiencia": "descripción de experiencia laboral en texto",
  "educacion": "descripción de educación en texto",
  "habilidades_tecnicas": ["habilidad1", "habilidad2"],
  "habilidades_blandas": "habilidad1, habilidad2"
}

Responde SOLO con el JSON.`
        }
      ]
    });

    const text = message.content[0].text.replace(/```json|```/g, '').trim();
    const datos = JSON.parse(text);

    res.json({ datos });
  } catch (error) {
    console.log('ERROR extraer CV:', error.message);
    res.status(500).json({ error: error.message });
  }
};