const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  const { nombre, email, telefono, experiencia, educacion, habilidades, foto } = req.body;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Eres un experto en CVs peruanos. Genera SOLO el contenido en formato JSON con estos campos exactos, sin explicaciones ni texto adicional:
{
  "nombre": "${nombre}",
  "email": "${email}",
  "telefono": "${telefono}",
  "perfil": "párrafo de 3 líneas sobre el candidato",
  "experiencia": [{"cargo": "...", "empresa": "...", "periodo": "...", "logros": ["...", "...", "..."]}],
  "educacion": [{"titulo": "...", "institucion": "...", "año": "..."}],
  "habilidades_tecnicas": ["...", "...", "..."],
  "habilidades_blandas": ["...", "...", "..."]
}

USA EXACTAMENTE estos datos del usuario:
Nombre: ${nombre}
Email: ${email}
Teléfono: ${telefono}
Experiencia: ${experiencia}
Educación: ${educacion}
Habilidades: ${habilidades}

Responde SOLO con el JSON, sin markdown ni explicaciones.`
        }
      ]
    });

    let cvData;
    try {
      const text = message.content[0].text.replace(/```json|```/g, '').trim();
      cvData = JSON.parse(text);
    } catch (e) {
      cvData = { error: 'Error parseando respuesta' };
    }

    res.json({ cv: cvData, foto: foto || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};