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
          content: `Genera un CV profesional en español para el mercado peruano con la siguiente información:
          Nombre: ${nombre}
          Email: ${email}
          Teléfono: ${telefono}
          Experiencia: ${experiencia}
          Educación: ${educacion}
          Habilidades: ${habilidades}
          
          INSTRUCCIONES ESTRICTAS:
          - Incluye ÚNICAMENTE estas 5 secciones: DATOS PERSONALES, PERFIL PROFESIONAL, EXPERIENCIA LABORAL, EDUCACIÓN, HABILIDADES
          - NO agregues recomendaciones, consejos, tips, notas, ni comentarios adicionales
          - NO agregues secciones extras
          - NO hagas preguntas al final
          - Termina el CV después de la sección HABILIDADES`
        }
      ]
    });

    res.json({ cv: message.content[0].text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};