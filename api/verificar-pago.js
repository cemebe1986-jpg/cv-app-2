const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { uid } = req.query;
  if (!uid) return res.status(400).json({ pagado: false });

  try {
    // Verificar pago en Redis
    const pagoData = await redis.get(`descarga:${uid}`);
    if (!pagoData) return res.json({ pagado: false });

    const pago = typeof pagoData === 'string' ? JSON.parse(pagoData) : pagoData;

    // Verificar si tiene CV guardado con su uid
    const tieneCv = await redis.exists(`cv:usuario:${uid}`);

    return res.json({
      pagado: true,
      cvs: pago.cvs || 1,
      plan: pago.plan || 'basico',
      token: pago.token,
      tieneCv: tieneCv === 1
    });
  } catch (error) {
    console.error('Error verificar-pago:', error.message);
    res.json({ pagado: false });
  }
};
