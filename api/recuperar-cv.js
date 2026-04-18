const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();

  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'uid requerido' });

  try {
    // Buscar primero el CV congelado al momento del pago
    // Si no existe, buscar el CV más reciente del usuario
    const data = await redis.get(`cv:pagado:${uid}`) || await redis.get(`cv:usuario:${uid}`);
    if (!data) return res.status(404).json({ error: 'CV no encontrado' });

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    res.json(parsed);
  } catch (error) {
    console.error('Error recuperar-cv:', error.message);
    res.status(500).json({ error: error.message });
  }
};
