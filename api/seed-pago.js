// Script temporal para guardar el pago manualmente en Redis
// Ejecutar UNA VEZ: node seed-pago.js
const { Redis } = require('@upstash/redis');
require('dotenv').config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function main() {
  const usuarioId = 'LvgCmXz84FQMuGWXOBy4tROd9ki2';
  const plan = 'basico';
  const cvs = 1;
  const token = `mp_154404398111_${Date.now()}`;

  await redis.setex(`descarga:${usuarioId}`, 60 * 60 * 24 * 30, JSON.stringify({
    token, cvs, plan,
    pagoId: '154404398111',
    fecha: new Date().toISOString()
  }));

  console.log('✅ Pago guardado en Redis para:', usuarioId);
  process.exit(0);
}

main().catch(console.error);
