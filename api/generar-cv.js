const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  const {
    nombre, email, telefono, experiencia, educacion,
    habilidades, habilidadesBlandas, oferta,
    mejorarExperiencia, sugerenciasLogros, cargo, empresa,
    sugerenciasHabilidades, mejorarPerfil, perfil
  } = req.body;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {

    // SUGERENCIAS DE LOGROS POR CARGO
    if (sugerenciasLogros) {
      if (!cargo) return res.status(400).json({ error: 'Cargo requerido' });
      const prompt = `Eres un experto en CVs profesionales para el mercado peruano y latinoamericano.
Genera exactamente 6 logros profesionales específicos y medibles para el cargo: "${cargo}"${empresa ? ` en ${empresa}` : ''}.

REGLAS:
- Usa verbos de acción: gestioné, implementé, reduje, aumenté, lideré, optimicé, desarrollé, supervisé
- Incluye números concretos, porcentajes o montos en soles cuando sea relevante
- Cada logro máximo 15 palabras
- Sé específico para este cargo exacto
- Lenguaje profesional del mercado peruano
- Responde SOLO con JSON sin markdown

{"sugerencias": ["logro 1", "logro 2", "logro 3", "logro 4", "logro 5", "logro 6"]}`;

      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:600, messages:[{role:'user',content:prompt}] });
      try { return res.json(JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())); }
      catch(e) { return res.json({ sugerencias: [] }); }
    }

    // SUGERENCIAS DE HABILIDADES
    if (sugerenciasHabilidades) {
      if (!cargo) return res.status(400).json({ error: 'Cargo requerido' });
      const prompt = `Eres un experto en RRHH y CVs para el mercado peruano.
Lista exactamente 8 habilidades técnicas más demandadas para el cargo: "${cargo}".

REGLAS:
- Solo habilidades técnicas (herramientas, software, metodologías)
- No incluyas habilidades blandas
- Ordena de mayor a menor importancia
- Máximo 3 palabras por habilidad
- Responde SOLO con JSON sin markdown

{"sugerencias": ["hab 1", "hab 2", "hab 3", "hab 4", "hab 5", "hab 6", "hab 7", "hab 8"]}`;

      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:400, messages:[{role:'user',content:prompt}] });
      try { return res.json(JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())); }
      catch(e) { return res.json({ sugerencias: [] }); }
    }

    // MEJORAR PERFIL PROFESIONAL
    if (mejorarPerfil) {
      const prompt = `Eres un experto en CVs profesionales para el mercado peruano.
Reescribe este perfil profesional haciéndolo más impactante para reclutadores.

CARGO: ${cargo || 'Profesional'}
EXPERIENCIA EN: ${experiencia || 'diversas áreas'}
PERFIL ACTUAL: ${perfil || ''}

REGLAS:
- Máximo 3 oraciones potentes
- Empieza con el cargo o especialidad
- Destaca el valor que aporta al empleador
- Lenguaje activo y profesional para el mercado peruano
- Responde SOLO con JSON sin markdown

{"perfil": "párrafo mejorado aquí"}`;

      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:400, messages:[{role:'user',content:prompt}] });
      try { return res.json(JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())); }
      catch(e) { return res.json({ perfil: perfil || '' }); }
    }

    // MEJORAR EXPERIENCIA
    if (mejorarExperiencia) {
      const prompt = `Eres un experto en CVs profesionales para el mercado peruano.
Mejora esta experiencia laboral con lenguaje profesional e impactante.

EXPERIENCIA:
${experiencia}

INSTRUCCIONES:
- Mantén cargos, empresas y fechas exactas
- Reescribe logros con verbos de acción: gestioné, implementé, reduje, aumenté, lideré
- Agrega impacto medible (%, números, soles) cuando sea posible
- Mínimo 3 logros por trabajo
- Responde SOLO con JSON sin markdown

{"experiencia": [{"cargo": "...", "empresa": "...", "periodo": "...", "logros": ["...", "...", "..."]}]}`;

      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:1000, messages:[{role:'user',content:prompt}] });
      try { return res.json({ cv: JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim()) }); }
      catch(e) { return res.json({ cv: { experiencia: [] } }); }
    }

    // GENERAR CV COMPLETO
    const tieneOferta = oferta && oferta.trim().length > 0;
    const promptBase = `Eres un experto en CVs peruanos. Genera un CV COMPLETO usando EXACTAMENTE los datos dados. NO uses placeholders.

DATOS DEL CANDIDATO:
- Nombre: ${nombre}
- Email: ${email}
- Teléfono: ${telefono}
- Experiencia: ${experiencia}
- Educación: ${educacion}
- Habilidades técnicas: ${habilidades}
- Habilidades blandas: ${habilidadesBlandas}
${tieneOferta ? `\nOFERTA DE TRABAJO A LA QUE POSTULA:\n${oferta}` : ''}

INSTRUCCIONES:
- Usa EXACTAMENTE los datos del candidato, NO inventes nada
- Perfil: 3 líneas impactantes basadas en la experiencia real
- Mejora la redacción de logros pero mantén cargos/empresas/fechas exactas
${tieneOferta ? `- ANÁLISIS DE COMPATIBILIDAD: Lee cuidadosamente el texto de la oferta de trabajo. Extrae las keywords que aparecen EXPLÍCITAMENTE en esa oferta (tecnologías, herramientas, habilidades, requisitos mencionados). Luego revisa los datos del candidato y determina cuáles coinciden. NO inventes ni uses keywords de otras ofertas o industrias. El score (0-100) debe ser honesto: refleja el porcentaje real de keywords de la oferta que tiene el candidato.` : ''}
- Responde SOLO con JSON válido sin markdown

{
  "nombre": "${nombre}",
  "email": "${email}",
  "telefono": "${telefono}",
  "perfil": "párrafo de 3 líneas",
  "experiencia": [{"cargo": "...", "empresa": "...", "periodo": "...", "logros": ["...", "...", "..."]}],
  "educacion": [{"titulo": "...", "institucion": "...", "año": "..."}]
  ${tieneOferta ? `,"compatibilidad": {
    "score": 0,
    "keywords_encontradas": ["keywords que están TANTO en la oferta como en el perfil del candidato"],
    "keywords_faltantes": ["keywords importantes de la oferta que el candidato NO tiene"],
    "recomendaciones": ["consejo específico y accionable para mejorar compatibilidad con esta oferta específica"]
  }` : ''}
}`;

    const message = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:2000, messages:[{role:'user',content:promptBase}] });
    let cvData;
    try { cvData = JSON.parse(message.content[0].text.replace(/```json|```/g,'').trim()); }
    catch(e) { cvData = { error: 'Error parseando respuesta' }; }
    res.json({ cv: cvData });

  } catch(error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};
