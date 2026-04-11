const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  const {
    nombre, email, telefono, experiencia, educacion,
    habilidades, habilidadesBlandas, oferta, mejorarExperiencia
  } = req.body;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {

    // ── MEJORAR EXPERIENCIA ──────────────────────────────────────────────
    if (mejorarExperiencia) {
      const promptMejora = `Eres un experto en CVs profesionales para el mercado peruano.
El usuario te da su experiencia laboral en formato simple. Tu tarea es mejorarla con lenguaje profesional e impactante.

EXPERIENCIA DEL USUARIO:
${experiencia}

INSTRUCCIONES:
- Mantén los mismos cargos, empresas y fechas exactas que dio el usuario
- Reescribe los logros con verbos de acción fuertes: gestioné, implementé, reduje, aumenté, lideré, optimicé
- Agrega impacto medible cuando sea posible (%, números, montos en soles)
- Usa lenguaje profesional del mercado peruano
- Cada trabajo debe tener mínimo 3 logros
- Responde SOLO con JSON válido sin markdown ni texto adicional

Formato JSON requerido:
{
  "experiencia": [
    {
      "cargo": "cargo exacto del usuario",
      "empresa": "empresa exacta del usuario",
      "periodo": "fechas exactas del usuario",
      "logros": ["logro mejorado 1", "logro mejorado 2", "logro mejorado 3"]
    }
  ]
}`;

      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: promptMejora }]
      });

      let mejoraData;
      try {
        const text = message.content[0].text.replace(/```json|```/g, '').trim();
        mejoraData = JSON.parse(text);
      } catch(e) {
        mejoraData = { error: 'Error parseando respuesta' };
      }

      return res.json({ cv: mejoraData });
    }

    // ── GENERAR CV COMPLETO ──────────────────────────────────────────────
    const tieneOferta = oferta && oferta.trim().length > 0;

    const promptBase = `Eres un experto en CVs peruanos. Genera un CV COMPLETO usando EXACTAMENTE los datos que te doy abajo. NO uses placeholders ni dejes campos vacíos.

DATOS DEL USUARIO:
- Nombre: ${nombre}
- Email: ${email}
- Teléfono: ${telefono}
- Experiencia: ${experiencia}
- Educación: ${educacion}
- Habilidades técnicas: ${habilidades}
- Habilidades blandas: ${habilidadesBlandas}
${tieneOferta ? `\nOFERTA DE TRABAJO:\n${oferta}` : ''}

INSTRUCCIONES:
- Usa EXACTAMENTE los datos proporcionados
- NO inventes ni dejes campos vacíos
- Solo estas secciones en el JSON: perfil, experiencia, educacion
${tieneOferta ? '- Optimiza el perfil profesional para que resalte las habilidades que pide la oferta de trabajo' : ''}
- Responde SOLO con JSON válido sin markdown

Formato JSON requerido:
{
  "nombre": "${nombre}",
  "email": "${email}",
  "telefono": "${telefono}",
  "perfil": "párrafo de 3 líneas optimizado",
  "experiencia": [{"cargo": "...", "empresa": "...", "periodo": "...", "logros": ["...", "...", "..."]}],
  "educacion": [{"titulo": "...", "institucion": "...", "año": "..."}]
  ${tieneOferta ? ',"compatibilidad": {"score": 85, "keywords_encontradas": ["palabra1", "palabra2"], "keywords_faltantes": ["palabra3"], "recomendaciones": ["recomendacion1", "recomendacion2"]}' : ''}
}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: promptBase }]
    });

    let cvData;
    try {
      const text = message.content[0].text.replace(/```json|```/g, '').trim();
      cvData = JSON.parse(text);
    } catch (e) {
      cvData = { error: 'Error parseando respuesta' };
    }

    res.json({ cv: cvData });

  } catch (error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};