const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const { uid } = req.query;
  if (!uid) return res.status(400).json({ pagado: false, tieneCv: false });

  try {
    // Verificar pago
    const pagoData = await redis.get(`descarga:${uid}`);
    const pago = pagoData ? (typeof pagoData === 'string' ? JSON.parse(pagoData) : pagoData) : null;

    // Verificar si tiene CV guardado
    const tieneCv = await redis.exists(`cv:usuario:${uid}`);

    // Verificar si tiene CV congelado para descarga
    const tieneCvPagado = await redis.exists(`cv:pagado:${uid}`);

    return res.json({
      pagado: !!pago,
      cvs: pago?.cvs || 1,
      plan: pago?.plan || 'basico',
      token: pago?.token || null,
      tieneCv: tieneCv === 1,
      cvActualPagado: tieneCvPagado === 1,
      tieneEntrevista: pago?.entrevista || false,
      regeneracionesRestantes: pago?.regeneraciones ?? 5
    });
  } catch (error) {
    console.error('Error verificar-pago:', error.message);
    res.json({ pagado: false, tieneCv: false });
  }
};
