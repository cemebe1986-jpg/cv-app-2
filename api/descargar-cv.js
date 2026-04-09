const { Redis } = require('@upstash/redis');
const { jsPDF } = require('jspdf');

module.exports = async (req, res) => {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: 'ID requerido' });

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    // Verificar si está pagado
    const pagado = await redis.get(`pagado:${id}`);
    if (!pagado) {
      return res.status(403).json({ error: 'Pago no verificado' });
    }

    // Obtener datos del CV
    const cvRaw = await redis.get(`cv:${id}`);
    if (!cvRaw) {
      return res.status(404).json({ error: 'CV no encontrado o expirado' });
    }

    const { cvData, habilidades } = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;

    // Generar PDF sin marca de agua
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(cvData.nombre || 'CV Profesional', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${cvData.email || ''} | ${cvData.telefono || ''}`, pageWidth / 2, 28, { align: 'center' });

    // Línea
    doc.setDrawColor(15, 52, 96);
    doc.setLineWidth(0.5);
    doc.line(15, 40, pageWidth - 15, 40);

    let y = 50;

    // Perfil
    doc.setFillColor(15, 52, 96);
    doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PERFIL PROFESIONAL', 18, y);
    y += 10;
    doc.setTextColor(45, 55, 72);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const perfilLines = doc.splitTextToSize(cvData.perfil || '', 175);
    perfilLines.forEach(l => { doc.text(l, 15, y); y += 6; });
    y += 5;

    // Experiencia
    doc.setFillColor(15, 52, 96);
    doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('EXPERIENCIA LABORAL', 18, y);
    y += 10;

    (cvData.experiencia || []).forEach(exp => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setTextColor(26, 26, 46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(exp.cargo || '', 15, y);
      y += 6;
      doc.setTextColor(15, 52, 96);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${exp.empresa || ''} | ${exp.periodo || ''}`, 15, y);
      y += 6;
      (exp.logros || []).forEach(l => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setTextColor(45, 55, 72);
        doc.text(`▸ ${l}`, 18, y);
        y += 5;
      });
      y += 4;
    });

    // Educación
    y += 3;
    doc.setFillColor(15, 52, 96);
    doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('EDUCACIÓN', 18, y);
    y += 10;

    (cvData.educacion || []).forEach(edu => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setTextColor(26, 26, 46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(edu.titulo || '', 15, y);
      y += 6;
      doc.setTextColor(15, 52, 96);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${edu.institucion || ''} | ${edu.año || ''}`, 15, y);
      y += 8;
    });

    // Habilidades
    y += 3;
    doc.setFillColor(15, 52, 96);
    doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('HABILIDADES', 18, y);
    y += 10;
    doc.setTextColor(45, 55, 72);
    doc.setFont('helvetica', 'normal');
    const habilidadesTexto = (habilidades || []).map(h => `${h.nombre} (${'●'.repeat(h.nivel)}${'○'.repeat(5 - h.nivel)})`).join('  |  ');
    const habLines = doc.splitTextToSize(habilidadesTexto, 175);
    habLines.forEach(l => { doc.text(l, 15, y); y += 6; });

    // Footer
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 285, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('TalentIA | Tu CV profesional con IA', pageWidth / 2, 292, { align: 'center' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=mi-cv-profesional.pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.log('ERROR descarga:', error.message);
    res.status(500).json({ error: error.message });
  }
};