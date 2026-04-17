const { MercadoPagoConfig, Payment } = require('mercadopago');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).send('OK');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { type, data } = req.body;

    if (type !== 'payment') return res.status(200).json({ ok: true });
    if (!data?.id) return res.status(200).json({ ok: true });

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: data.id });

    console.log(`Payment ${data.id} status: ${payment.status}`);

    if (payment.status !== 'approved') return res.status(200).json({ ok: true });

    const [usuarioId, plan] = (payment.external_reference || '').split('|');
    if (!usuarioId || !plan) {
      console.log('Sin external_reference válido:', payment.external_reference);
      return res.status(200).json({ ok: true });
    }

    const planes = { basico: 1, popular: 3 };
    const limiteDescargasDia = { basico: 3, popular: 5 };
    const cvs = planes[plan] || 1;
    const token = `mp_${payment.id}_${Date.now()}`;

    // Guardar token de pago
    await redis.setex(`descarga:${usuarioId}`, 60 * 60 * 24 * 30, JSON.stringify({
      token, cvs, plan,
      limiteDia: limiteDescargasDia[plan] || 3,
      pagoId: payment.id,
      fecha: new Date().toISOString()
    }));

    // Congelar el CV actual al momento del pago
    // Así la descarga siempre corresponde al CV por el que se pagó
    const cvActual = await redis.get(`cv:usuario:${usuarioId}`);
    if (cvActual) {
      await redis.setex(`cv:pagado:${usuarioId}`, 60 * 60 * 24 * 30, 
        typeof cvActual === 'string' ? cvActual : JSON.stringify(cvActual)
      );
      console.log(`✅ CV congelado para: ${usuarioId}`);
    }

    console.log(`✅ Pago guardado: ${usuarioId} → ${plan} (${cvs} CVs, ${limiteDescargasDia[plan]} descargas/día)`);
    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Webhook MP Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
