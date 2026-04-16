const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { textoCV } = req.body;
    if (!textoCV) return res.status(400).json({ error: 'No se recibió texto' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extrae la información de este CV y devuelve SOLO un JSON válido sin markdown ni backticks.

CV:
${textoCV}

Devuelve exactamente esta estructura:
{
  "nombre": "nombre completo",
  "email": "email",
  "telefono": "teléfono sin código de país",
  "ciudad": "ciudad",
  "trabajos": [
    {
      "cargo": "título del puesto exacto",
      "empresa": "nombre de la empresa exacto",
      "desde": "año o mes/año de inicio",
      "hasta": "año o mes/año de fin, o 'Actualidad' si es trabajo actual",
      "logros": ["logro o responsabilidad 1", "logro o responsabilidad 2", "logro o responsabilidad 3"]
    }
  ],
  "educacion": [
    {
      "tipo": "universitaria",
      "titulo": "nombre del grado o título",
      "institucion": "nombre de la institución",
      "desde": "",
      "hasta": "año de graduación o 'En curso'"
    }
  ],
  "certificaciones": ["certificación 1", "certificación 2"],
  "habilidades_tecnicas": ["habilidad1", "habilidad2"],
  "habilidades_blandas": "habilidad1, habilidad2",
  "idiomas": "idioma1 nivel, idioma2 nivel"
}

REGLAS:
- Extrae TODOS los trabajos como objetos separados en el array trabajos
- Para cada trabajo, separa cargo y empresa correctamente
- Los logros deben ser strings individuales, no un solo texto largo
- Para educación, el tipo puede ser: universitaria, maestria, certificacion, tecnica
- Si hay certificaciones separadas de la educación, ponlas en el array certificaciones
- Responde SOLO con el JSON, sin explicaciones`
      }]
    });

    const text = message.content[0].text.replace(/```json|```/g, '').trim();
    const datos = JSON.parse(text);

    res.json({ datos });
  } catch (error) {
    console.log('ERROR extraer CV:', error.message);
    res.status(500).json({ error: error.message });
  }
};
