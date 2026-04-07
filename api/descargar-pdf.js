module.exports = async (req, res) => {
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
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
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
    res.status(500).json({ error: error.message });
  }
};