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
- Para cada trabajo, separa cargo y empresa correctamente aunque estén en la misma línea
- Los logros deben ser strings individuales, no un solo texto largo
- Para educación, el tipo puede ser: universitaria, maestria, certificacion, tecnica
- Si hay certificaciones separadas de la educación, ponlas en el array certificaciones

REGLAS DE FECHAS — extrae SOLO el año en "desde" y "hasta":
- "Nov 2019 - presente" → desde: "2019", hasta: "Actualidad"
- "11/2019 - 10/2023" → desde: "2019", hasta: "2023"  
- "Noviembre 2019 – Octubre 2023" → desde: "2019", hasta: "2023"
- "2019 - 2023" → desde: "2019", hasta: "2023"
- "Agosto 2015 - Mayo 2018" → desde: "2015", hasta: "2018"
- "presente", "actual", "a la fecha", "current", "la actualidad" → hasta: "Actualidad"
- Si no hay fecha de inicio → desde: ""
- Si no hay fecha de fin → hasta: ""

REGLAS DE EMPRESA Y CARGO — separa correctamente:
- "BBVA Perú, Nov 2019 - presente" → empresa: "BBVA Perú" (sin la fecha)
- "Arquitecto de Seguridad | BBVA Perú" → cargo: "Arquitecto de Seguridad", empresa: "BBVA Perú"
- "BBVA Perú (Nov 2019 - presente)" → empresa: "BBVA Perú" (sin paréntesis ni fecha)
- "Experis/Rimac Seguros" → empresa: "Experis/Rimac Seguros" (mantener tal cual)

REGLAS DE EDUCACIÓN:
- "Candidato MBA en Administración" → tipo: "maestria", titulo: "MBA en Administración", hasta: "En curso"
- "Titulado en Ingeniería de Sistemas" → tipo: "universitaria", titulo: "Ingeniería de Sistemas"
- "Maestría en Dirección de TI" → tipo: "maestria"
- Si dice "candidato", "en curso", "cursando" → hasta: "En curso"
- Certificaciones con ID → ponlas en el array certificaciones con su ID

REGLAS DE TELÉFONO:
- "+51 997532149" → "997532149" (sin código de país)
- "(+51) 997532149" → "997532149"
- "997-532-149" → "997532149"

Responde SOLO con el JSON, sin explicaciones`
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
