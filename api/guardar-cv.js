const { Redis } = require('@upstash/redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { cvData, foto, habilidades, usuarioId } = req.body;
  
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    // ID aleatorio para la descarga (compatible con flujo existente)
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    const cvPayload = JSON.stringify({ cvData, foto, habilidades });
    
    // Guardar con ID aleatorio — expira en 24h
    await redis.set(`cv:${id}`, cvPayload, { ex: 86400 });

    // Si hay usuario logueado, guardar también con su uid — expira en 30 días
    // Así podemos recuperar el CV cuando vuelve de Mercado Pago
    if (usuarioId) {
      await redis.set(`cv:usuario:${usuarioId}`, cvPayload, { ex: 60 * 60 * 24 * 30 });
    }

    res.json({ id });
  } catch (error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};
