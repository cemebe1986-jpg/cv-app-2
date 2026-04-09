const Anthropic = require('@anthropic-ai/sdk');
const pdfParse = require('pdf-parse');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { archivoBase64, tipoArchivo } = req.body;

    if (!archivoBase64) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let textoCV = '';

    // Extraer texto del PDF
    if (tipoArchivo === 'application/pdf') {
      const buffer = Buffer.from(archivoBase64, 'base64');
      const data = await pdfParse(buffer);
      textoCV = data.text;
    } else {
      // Para Word u otros formatos, enviamos directo a Claude
      textoCV = Buffer.from(archivoBase64, 'base64').toString('utf-8');
    }

    // Claude extrae los datos estructurados
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Extrae la información de este CV y devuelve SOLO un JSON válido sin markdown:

${textoCV}

Formato exacto requerido:
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

Si no encuentras algún dato deja el campo vacío. Responde SOLO con el JSON.`
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