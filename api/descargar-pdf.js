module.exports = async (req, res) => {
  const { contenido } = req.body;

  try {
    const { jsPDF } = require('jspdf');
    
    const doc = new jsPDF();
    
    const lineas = doc.splitTextToSize(contenido, 180);
    doc.setFontSize(11);
    doc.text(lineas, 15, 20);
    
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=mi-cv.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};