const { MercadoPagoConfig, Preference } = require('mercadopago');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { plan, usuarioId, email } = req.body;
  if (!plan || !usuarioId) return res.status(400).json({ error: 'Plan y usuarioId requeridos' });

  const planes = {
    basico:  { titulo: 'TalentIA — Plan Básico (CV)',              precio: 4.90,  cvs: 1, entrevista: false },
    popular: { titulo: 'TalentIA — CV + Simulación de Entrevista con IA', precio: 9.90,  cvs: 1, entrevista: true  }
  };

  const planData = planes[plan];
  if (!planData) return res.status(400).json({ error: 'Plan inválido' });

  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          title: planData.titulo,
          quantity: 1,
          unit_price: planData.precio,
          currency_id: 'PEN'
        }],
        payer: { email: email || '' },
        external_reference: `${usuarioId}|${plan}|${Date.now()}`,
        back_urls: {
          success: 'https://talentia.com.pe/crear?pago=ok',
          failure: 'https://talentia.com.pe/crear?pago=error',
          pending: 'https://talentia.com.pe/crear?pago=pendiente'
        },
        auto_return: 'approved',
        notification_url: 'https://talentia.com.pe/webhook-mp',
        statement_descriptor: 'TALENTIA CV'
      }
    });

    res.json({ init_point: result.init_point, id: result.id });
  } catch (error) {
    console.error('MP Error:', error.message);
    res.status(500).json({ error: 'Error creando preferencia de pago' });
  }
};
