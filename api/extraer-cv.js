const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { archivoBase64, tipoArchivo } = req.body;

    if (!archivoBase64) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: tipoArchivo === 'application/pdf' ? 'application/pdf' : 'application/pdf',
                data: archivoBase64
              }
            },
            {
              type: 'text',
              text: `Extrae la información de este CV y devuelve SOLO un JSON válido sin markdown:

{
  "nombre": "nombre completo",