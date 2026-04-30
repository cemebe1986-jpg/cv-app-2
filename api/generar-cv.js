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

    // EXTRAER PUESTO DE OFERTA
    if (req.body.extraerPuestoOferta) {
      const prompt = `Extrae SOLO el nombre del puesto de trabajo de esta oferta laboral. 
Responde SOLO con JSON: {"puesto": "nombre del puesto"}
Si no puedes identificar el puesto claramente, responde: {"puesto": ""}

OFERTA:
${oferta?.substring(0, 500) || ''}`;
      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:100, messages:[{role:'user',content:prompt}] });
      try { return res.json(JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())); }
      catch(e) { return res.json({ puesto: '' }); }
    }

    // SUGERENCIAS DE LOGROS POR CARGO
    if (sugerenciasLogros) {
      if (!cargo) return res.status(400).json({ error: 'Cargo requerido' });
      const prompt = `Eres un experto en CVs profesionales para el mercado peruano.

Tu tarea: generar exactamente 6 logros para alguien con el cargo "${cargo}"${empresa ? `, que trabaja en ${empresa}` : ''}.

REGLA PRINCIPAL: Los logros deben reflejar LAS FUNCIONES DEL CARGO, no el rubro de la empresa.
Ejemplos:
- Cargo "Doctor" en BBVA → logros médicos (atención pacientes, diagnósticos, procedimientos). BBVA puede tener médicos en su área de salud ocupacional.
- Cargo "Abogado" en minera → logros legales (contratos, litigios, cumplimiento normativo)
- Cargo "Contador" en hospital → logros contables (cierres, auditorías, presupuestos)
- Cargo "Ingeniero de Sistemas" en banco → logros tecnológicos (sistemas, desarrollo, infraestructura)

PARA EL CARGO "${cargo}":
Piensa: ¿qué hace alguien con este cargo día a día? Genera logros basados en esas funciones reales.

FORMATO DE CADA LOGRO:
- Verbo de acción + qué hiciste + resultado concreto (número, % o impacto)
- Máximo 15 palabras
- Usa [X] como placeholder para números que el usuario completará
- Lenguaje profesional peruano

Responde SOLO con este JSON sin markdown ni explicaciones:
{"sugerencias": ["logro 1", "logro 2", "logro 3", "logro 4", "logro 5", "logro 6"]}`;

      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:600, messages:[{role:'user',content:prompt}] });
      try { return res.json(JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())); }
      catch(e) { return res.json({ sugerencias: [] }); }
    }

    // SUGERENCIAS DE HABILIDADES BLANDAS
    if (req.body.sugerenciasBlandas) {
      const prompt = `Eres un experto en RRHH y CVs para el mercado peruano.
Lista exactamente 8 habilidades blandas más relevantes para este perfil.

CARGO: ${cargo || 'Profesional'}
${oferta ? `OFERTA DE TRABAJO:\n${oferta.substring(0, 500)}` : ''}

REGLAS:
- Solo habilidades blandas (actitudes, competencias interpersonales)
- NO incluyas habilidades técnicas
- Si hay oferta, prioriza las blandas que menciona explícitamente
- Si no hay oferta, basa las sugerencias en el cargo
- Máximo 3 palabras por habilidad
- Relevantes para el mercado laboral peruano
- Responde SOLO con JSON sin markdown

{"sugerencias": ["hab 1", "hab 2", "hab 3", "hab 4", "hab 5", "hab 6", "hab 7", "hab 8"]}`;

      const msg = await client.messages.create({ model:'claude-haiku-4-5', max_tokens:400, messages:[{role:'user',content:prompt}] });
      try { return res.json(JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())); }
      catch(e) { return res.json({ sugerencias: [] }); }
    }

    // SUGERENCIAS DE HABILIDADES TÉCNICAS
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
    const tienePuesto = cargo && cargo.trim().length > 0;
    const tieneCompatibilidad = tieneOferta || tienePuesto;

    const instruccionCompatibilidad = tieneOferta ? 
`- ANÁLISIS DE COMPATIBILIDAD CON OFERTA: La oferta puede ser de una empresa de cualquier rubro pero el PUESTO puede ser tecnológico, administrativo u otro. IGNORA el rubro de la empresa. Enfócate ÚNICAMENTE en las funciones, requisitos y competencias técnicas del PUESTO en sí. Extrae keywords del puesto: herramientas, tecnologías, habilidades técnicas, certificaciones, metodologías. Compara esas keywords con la experiencia y habilidades del candidato. El score (0-100) debe ser honesto y preciso.` 
: tienePuesto ?
`- ANÁLISIS DE COMPATIBILIDAD CON PUESTO: El candidato postula a "${cargo}". Analiza qué tan bien encaja su CV para este cargo en el mercado peruano. Evalúa: ¿tiene la experiencia típica para este puesto? ¿tiene las habilidades técnicas más demandadas? ¿su perfil está orientado a este cargo? Sé específico y honesto. El score (0-100) debe reflejar la realidad del mercado laboral peruano para este puesto.`
: '';

    const campoCompatibilidad = tieneCompatibilidad ? `,"compatibilidad": {
    "score": 0,
    "puesto_analizado": "${tieneOferta ? 'oferta específica' : cargo}",
    "fortalezas": ["fortaleza específica 1 del CV para este puesto", "fortaleza específica 2"],
    "brechas": ["habilidad o experiencia importante que le falta para este puesto", "otra brecha específica"],
    "recomendaciones": ["acción concreta y específica para mejorar compatibilidad", "otra acción específica"],
    "keywords_encontradas": ["keywords del puesto que sí tiene el candidato"],
    "keywords_faltantes": ["keywords importantes del puesto que le faltan al candidato"]
  }` : '';

    const promptBase = `Eres un experto en CVs peruanos y reclutamiento. Genera un CV COMPLETO usando EXACTAMENTE los datos dados. NO uses placeholders.

DATOS DEL CANDIDATO:
- Nombre: ${nombre}
- Email: ${email}
- Teléfono: ${telefono}
- Cargo deseado: ${cargo || 'No especificado'}
- Experiencia: ${experiencia}
- Educación: ${educacion}
- Habilidades técnicas: ${habilidades}
- Habilidades blandas: ${habilidadesBlandas}
${tieneOferta ? `\nOFERTA DE TRABAJO A LA QUE POSTULA:\n${oferta}` : ''}

INSTRUCCIONES:
- Usa EXACTAMENTE los datos del candidato, NO inventes nada
- Perfil: 3 líneas impactantes basadas en la experiencia real, orientadas al cargo deseado
- Mejora la redacción de logros pero mantén cargos/empresas/fechas exactas
${instruccionCompatibilidad}
- Responde SOLO con JSON válido sin markdown

{
  "nombre": "${nombre}",
  "email": "${email}",
  "telefono": "${telefono}",
  "perfil": "párrafo de 3 líneas orientado al cargo deseado",
  "experiencia": [{"cargo": "...", "empresa": "...", "periodo": "...", "logros": ["...", "...", "..."]}],
  "educacion": [{"titulo": "...", "institucion": "...", "año": "..."}]
  ${campoCompatibilidad}
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
