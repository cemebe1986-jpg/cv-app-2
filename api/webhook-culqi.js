const { Redis } = require('@upstash/redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const evento = req.body;
    console.log('Webhook Culqi:', JSON.stringify(evento));

    if (evento.type === 'charge.paid') {
      const metadata = evento.data?.object?.metadata || {};
      const cvId = metadata.cv_id;
      const email = evento.data?.object?.email;

      if (cvId) {
        await redis.set(`pagado:${cvId}`, email || 'pagado', { ex: 86400 });
        console.log(`CV ${cvId} marcado como pagado`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.log('ERROR webhook:', error.message);
    res.status(500).json({ error: error.message });
  }
};