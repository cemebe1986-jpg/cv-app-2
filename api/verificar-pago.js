const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { uid } = req.query;
  if (!uid) return res.status(400).json({ pagado: false });

  try {
    const data = await redis.get(`descarga:${uid}`);
    if (!data) return res.json({ pagado: false });

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return res.json({
      pagado: true,
      cvs: parsed.cvs || 1,
      plan: parsed.plan || 'basico',
      token: parsed.token
    });
  } catch (error) {
    console.error('Error verificar-pago:', error.message);
    res.json({ pagado: false });
  }
};
