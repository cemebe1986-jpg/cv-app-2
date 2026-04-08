const { Redis } = require('@upstash/redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { cvData, foto, habilidades } = req.body;
  
  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    await redis.set(`cv:${id}`, JSON.stringify({ cvData, foto, habilidades }), { ex: 3600 });

    res.json({ id });
  } catch (error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};