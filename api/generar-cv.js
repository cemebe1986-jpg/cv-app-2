const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  const { nombre, email, telefono, experiencia, educacion, habilidades } = req.body;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Eres un experto en CVs peruanos. Genera un CV COMPLETO usando EXACTAMENTE los datos que te doy abajo. NO uses placeholders como [Completa...] ni dejes campos vacíos. USA los datos tal como están.

DATOS DEL USUARIO:
- Nombre: ${nombre}
- Email: ${email}
- Teléfono: ${telefono}
- Experiencia: ${experiencia}
- Educación: ${educacion}
- Habilidades: ${habilidades}

INSTRUCCIONES:
- Usa EXACTAMENTE los datos proporcionados arriba
- NO inventes ni dejes campos vacíos
- Solo estas 5 secciones: DATOS PERSONALES, PERFIL PROFESIONAL, EXPERIENCIA LABORAL, EDUCACIÓN, HABILIDADES
- NO agregues consejos, recomendaciones ni preguntas al final`
        }
      ]
    });

    res.json({ cv: message.content[0].text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};