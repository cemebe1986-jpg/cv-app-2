const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

app.post('/generar-cv', async (req, res) => {
  const { nombre, email, telefono, experiencia, educacion, habilidades } = req.body;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Genera un CV profesional en español para el mercado peruano con la siguiente información:
          Nombre: ${nombre}
          Email: ${email}
          Teléfono: ${telefono}
          Experiencia: ${experiencia}
          Educación: ${educacion}
          Habilidades: ${habilidades}
          
          INSTRUCCIONES ESTRICTAS:
          - Incluye ÚNICAMENTE estas 5 secciones: DATOS PERSONALES, PERFIL PROFESIONAL, EXPERIENCIA LABORAL, EDUCACIÓN, HABILIDADES
          - NO agregues recomendaciones, consejos, tips, notas, ni comentarios adicionales
          - NO agregues secciones extras como referencias, idiomas, última actualización
          - NO hagas preguntas al final
          - Termina el CV después de la sección HABILIDADES, sin agregar nada más`
        }
      ]
    });

    console.log('Respuesta de Claude:', JSON.stringify(message.content));
    res.json({ cv: message.content[0].text });
  } catch (error) {
    console.log('ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/descargar-pdf', async (req, res) => {
  const { contenido } = req.body;
  
  try {
    const puppeteer = require('puppeteer');
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            color: #2d3748; 
            line-height: 1.8;
            font-size: 13px;
          }
          pre { 
            white-space: pre-wrap; 
            font-family: Arial, sans-serif; 
          }
        </style>
      </head>
      <body><pre>${contenido}</pre></body>
      </html>
    `;

    await page.setContent(htmlContent);
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=mi-cv.pdf');
    res.send(pdf);
  } catch (error) {
    console.log('ERROR PDF:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/guardar-cv', async (req, res) => {
  const { Redis } = require('@upstash/redis');
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
    console.log('ERROR guardar:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/descargar-cv', async (req, res) => {
  const { Redis } = require('@upstash/redis');
  const { jsPDF } = require('jspdf');
  const { id } = req.query;

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const pagado = await redis.get(`pagado:${id}`);
    if (!pagado) return res.status(403).json({ error: 'Pago no verificado' });

    const cvRaw = await redis.get(`cv:${id}`);
    if (!cvRaw) return res.status(404).json({ error: 'CV no encontrado' });

    const { cvData, habilidades } = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(cvData.nombre || 'CV', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cvData.email || ''} | ${cvData.telefono || ''}`, pageWidth / 2, 28, { align: 'center' });

    let y = 50;
    doc.setTextColor(45, 55, 72);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const perfilLines = doc.splitTextToSize(cvData.perfil || '', 175);
    perfilLines.forEach(l => { doc.text(l, 15, y); y += 6; });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=mi-cv.pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.log('ERROR descarga:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});