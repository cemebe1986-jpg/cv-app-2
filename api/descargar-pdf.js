module.exports = async (req, res) => {
  const { contenido } = req.body;

  try {
    const { jsPDF } = require('jspdf');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header con fondo morado
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Título en el header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('CURRICULUM VITAE', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Generado profesionalmente', pageWidth / 2, 29, { align: 'center' });
    
    // Línea decorativa
    doc.setDrawColor(102, 126, 234);
    doc.setLineWidth(0.5);
    doc.line(15, 42, pageWidth - 15, 42);
    
    // Contenido del CV
    doc.setTextColor(45, 55, 72);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const lineas = contenido.split('\n');
    let y = 50;
    
    lineas.forEach(linea => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      // Detectar secciones principales
      if (linea.toUpperCase() === linea && linea.trim().length > 0 && !linea.includes(':')) {
        y += 4;
        doc.setFillColor(102, 126, 234);
        doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(linea.trim(), 18, y);
        doc.setTextColor(45, 55, 72);
        doc.setFont('helvetica', 'normal');
        y += 8;
      } else {
        doc.setFontSize(10);
        const lineasWrapped = doc.splitTextToSize(linea, 175);
        lineasWrapped.forEach(l => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(l, 15, y);
          y += 6;
        });
      }
    });
    
    // Footer
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 285, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Generado con IA | CVPro Perú', pageWidth / 2, 292, { align: 'center' });
    
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=mi-cv.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};