const { MercadoPagoConfig, Payment } = require('mercadopago');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  // Mercado Pago envía GET para validar el webhook
  if (req.method === 'GET') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { type, data } = req.body;

    // Solo procesamos pagos aprobados
    if (type !== 'payment') return res.status(200).json({ ok: true });

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') return res.status(200).json({ ok: true });

    // Extraer datos del external_reference: usuarioId|plan|timestamp
    const [usuarioId, plan] = (payment.external_reference || '').split('|');
    if (!usuarioId || !plan) return res.status(200).json({ ok: true });

    const planes = { basico: 1, popular: 3 };
    const cvs = planes[plan] || 1;

    // Guardar token de descarga en Redis — expira en 30 días
    const token = `mp_${payment.id}_${Date.now()}`;
    await redis.setex(`descarga:${usuarioId}`, 60 * 60 * 24 * 30, JSON.stringify({
      token,
      cvs,
      plan,
      pagoId: payment.id,
      fecha: new Date().toISOString()
    }));

    console.log(`✅ Pago aprobado: ${usuarioId} → ${plan} (${cvs} CVs)`);
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Webhook MP Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
