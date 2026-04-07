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

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});