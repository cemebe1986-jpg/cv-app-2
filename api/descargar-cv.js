const { Redis } = require('@upstash/redis');

module.exports = async (req, res) => {
  const { id, uid, token, estilo: estiloParam } = req.query;

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    let cvData, habilidades, blandasData, foto, estilo;

    // Flujo nuevo: uid + token (Mercado Pago)
    if (uid && token) {
      const pagoRaw = await redis.get(`descarga:${uid}`);
      if (!pagoRaw) return res.status(403).json({ error: 'Pago no verificado' });
      const pago = typeof pagoRaw === 'string' ? JSON.parse(pagoRaw) : pagoRaw;
      if (pago.token !== token) return res.status(403).json({ error: 'Token inválido' });

      const cvRaw = await redis.get(`cv:usuario:${uid}`);
      if (!cvRaw) return res.status(404).json({ error: 'CV no encontrado. Genera tu CV de nuevo.' });
      const parsed = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;
      cvData = parsed.cvData;
      habilidades = parsed.habilidades || [];
      blandasData = parsed.blandasData || [];
      foto = parsed.foto || null;
      estilo = estiloParam || parsed.estilo || 'clasico';

    } else if (id) {
      const pagado = await redis.get(`pagado:${id}`);
      if (!pagado) return res.status(403).json({ error: 'Pago no verificado' });
      const cvRaw = await redis.get(`cv:${id}`);
      if (!cvRaw) return res.status(404).json({ error: 'CV no encontrado o expirado' });
      const parsed = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;
      cvData = parsed.cvData;
      habilidades = parsed.habilidades || [];
    } else {
      return res.status(400).json({ error: 'Parámetros requeridos' });
    }

    // Generar HTML del CV según el estilo
    const html = generarHTMLCV(cvData, habilidades, blandasData, foto, estilo);

    // Llamar a Browserless para generar el PDF
    const response = await fetch(`https://production-sfo.browserless.io/pdf?token=${process.env.BROWSERLESS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'about:blank',
        html,
        options: {
          format: 'A4',
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        },
        gotoOptions: { waitUntil: 'networkidle2' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Browserless error:', err);
      return res.status(500).json({ error: 'Error generando PDF' });
    }

    const pdfBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=mi-cv-talentia.pdf`);
    res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('ERROR descarga:', error.message);
    res.status(500).json({ error: error.message });
  }
};

function generarHTMLCV(cv, habilidades, blandas, foto, estilo) {
  const skills = (habilidades||[]).map(h => `<span class="skill-tag">${h.nombre||h}</span>`).join('');
  const softSkills = (blandas||[]).map(b => `<span class="soft-tag">${b.nombre||b}</span>`).join('');
  const fotoHTML = foto ? `<img src="${foto}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #60a5fa;display:block;margin:0 auto 12px;">` 
                       : `<div style="width:100px;height:100px;border-radius:50%;background:#0f3460;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:40px;">👤</div>`;

  const experienciaHTML = (cv.experiencia||[]).map(exp => `
    <div style="margin-bottom:18px;page-break-inside:avoid;">
      <div style="font-size:14px;font-weight:700;color:#1a1a2e;">${exp.cargo||''}</div>
      <div style="font-size:12px;color:#0f3460;font-weight:600;">${exp.empresa||''}</div>
      <div style="font-size:11px;color:#718096;margin-bottom:6px;">${exp.periodo||''}</div>
      ${(exp.logros||[]).map(l=>`<div style="font-size:11px;color:#4a5568;margin-left:12px;margin-bottom:3px;position:relative;">▸ ${l}</div>`).join('')}
    </div>`).join('');

  const educacionHTML = (cv.educacion||[]).map(edu => `
    <div style="margin-bottom:12px;page-break-inside:avoid;">
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${edu.titulo||''}</div>
      <div style="font-size:11px;color:#0f3460;">${edu.institucion||''}</div>
      <div style="font-size:10px;color:#718096;">${edu.año||''}</div>
    </div>`).join('');

  if (estilo === 'moderno') {
    // Estilo Ejecutivo - una columna centrada
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background:white; }
      .header { padding:32px 48px 20px; text-align:center; border-bottom:2px solid #1a1a2e; }
      .nombre { font-size:28px; font-weight:900; color:#1a1a2e; margin-bottom:8px; }
      .contacto { font-size:11px; color:#4a5568; display:flex; justify-content:center; gap:20px; flex-wrap:wrap; margin-bottom:12px; }
      .skills-row { display:flex; flex-wrap:wrap; justify-content:center; gap:4px; margin-top:8px; }
      .skill-tag { background:#1a1a2e; color:white; padding:2px 10px; border-radius:4px; font-size:10px; }
      .soft-tag { background:#f0f4ff; color:#1a1a2e; border:1px solid #cbd5e0; padding:2px 10px; border-radius:4px; font-size:10px; }
      .main { padding:24px 48px; }
      .perfil { font-size:11px; color:#4a5568; line-height:1.75; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid #e2e8f0; }
      .section-title { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:1.5px; color:#1a1a2e; border-bottom:2px solid #1a1a2e; padding-bottom:4px; margin-bottom:14px; text-align:center; }
      .section { margin-bottom:24px; page-break-inside:avoid; }
    </style></head><body>
    <div class="header">
      ${fotoHTML}
      <div class="nombre">${cv.nombre||''}</div>
      <div class="contacto">
        ${cv.email?`<span>📧 ${cv.email}</span>`:''}
        ${cv.telefono?`<span>📱 ${cv.telefono}</span>`:''}
      </div>
      <div class="skills-row">${skills}${softSkills}</div>
    </div>
    <div class="main">
      <div class="perfil">${cv.perfil||''}</div>
      <div class="section"><div class="section-title">Experiencia Laboral</div>${experienciaHTML}</div>
      <div class="section"><div class="section-title">Educación</div>${educacionHTML}</div>
    </div>
    </body></html>`;

  } else if (estilo === 'minimal') {
    // Estilo Minimalista
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background:white; }
      .header { background:#f8f9fa; padding:24px 40px 16px; border-bottom:3px solid #1a1a2e; }
      .nombre { font-size:26px; font-weight:800; color:#1a1a2e; margin-bottom:8px; }
      .contacto { display:flex; flex-wrap:wrap; gap:16px; margin-bottom:10px; }
      .contacto span { font-size:11px; color:#4a5568; }
      .skills-row { display:flex; flex-wrap:wrap; gap:4px; }
      .skill-tag { background:#e2e8f0; color:#1a1a2e; padding:2px 10px; border-radius:10px; font-size:10px; }
      .soft-tag { background:#e2e8f0; color:#1a1a2e; padding:2px 10px; border-radius:10px; font-size:10px; }
      .main { padding:24px 40px; }
      .perfil { font-size:11px; color:#4a5568; line-height:1.75; margin-bottom:20px; }
      .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#1a1a2e; margin-bottom:10px; padding-bottom:5px; border-bottom:2px solid #e2e8f0; }
      .section { margin-bottom:24px; page-break-inside:avoid; }
    </style></head><body>
    <div class="header">
      <div class="nombre">${cv.nombre||''}</div>
      <div class="contacto">
        ${cv.email?`<span>📧 ${cv.email}</span>`:''}
        ${cv.telefono?`<span>📱 ${cv.telefono}</span>`:''}
      </div>
      <div class="skills-row">${skills}${softSkills}</div>
    </div>
    <div class="main">
      <div class="perfil">${cv.perfil||''}</div>
      <div class="section"><div class="section-title">Experiencia Laboral</div>${experienciaHTML}</div>
      <div class="section"><div class="section-title">Educación</div>${educacionHTML}</div>
    </div>
    </body></html>`;

  } else {
    // Estilo Clásico - sidebar azul
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background:white; }
      .cv { display:grid; grid-template-columns:240px 1fr; min-height:100vh; }
      .sidebar { background:#1a1a2e; color:white; padding:32px 20px; }
      .foto-wrap { text-align:center; margin-bottom:20px; }
      .nombre-sidebar { font-size:14px; font-weight:700; text-align:center; margin-bottom:16px; }
      .section-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#60a5fa; margin-bottom:8px; padding-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.15); }
      .contact-item { font-size:10px; opacity:0.8; margin-bottom:6px; }
      .skill-tag { display:inline-block; background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); padding:3px 8px; border-radius:10px; font-size:10px; margin:2px; }
      .soft-tag { display:inline-block; background:rgba(255,255,255,0.1); color:white; padding:3px 8px; border-radius:10px; font-size:10px; margin:2px; }
      .main { padding:32px 28px; background:#fafbff; }
      .nombre-main { font-size:24px; font-weight:800; color:#1a1a2e; margin-bottom:4px; }
      .divider { width:50px; height:4px; background:#0f3460; border-radius:2px; margin-bottom:16px; }
      .perfil { font-size:11px; color:#4a5568; line-height:1.7; margin-bottom:24px; }
      .section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#0f3460; margin-bottom:12px; padding-bottom:5px; border-bottom:2px solid #e2e8f0; }
      .section { margin-bottom:24px; page-break-inside:avoid; }
      .exp-cargo { font-size:13px; font-weight:700; color:#1a1a2e; }
      .exp-empresa { font-size:11px; color:#0f3460; font-weight:600; }
      .exp-periodo { font-size:10px; color:#718096; margin-bottom:5px; }
      .exp-logro { font-size:10px; color:#4a5568; margin-left:12px; margin-bottom:3px; }
      .edu-titulo { font-size:12px; font-weight:700; color:#1a1a2e; }
      .edu-inst { font-size:10px; color:#0f3460; }
      .edu-año { font-size:10px; color:#718096; }
    </style></head><body>
    <div class="cv">
      <div class="sidebar">
        <div class="foto-wrap">${fotoHTML}</div>
        <div class="nombre-sidebar">${cv.nombre||''}</div>
        <div class="section-label">Contacto</div>
        ${cv.email?`<div class="contact-item">📧 ${cv.email}</div>`:''}
        ${cv.telefono?`<div class="contact-item">📱 ${cv.telefono}</div>`:''}
        <br>
        ${skills?`<div class="section-label" style="margin-top:12px;">Habilidades Técnicas</div><div style="margin-bottom:12px;">${skills}</div>`:''}
        ${softSkills?`<div class="section-label">Habilidades Blandas</div><div>${softSkills}</div>`:''}
      </div>
      <div class="main">
        <div class="nombre-main">${cv.nombre||''}</div>
        <div class="divider"></div>
        <div class="perfil">${cv.perfil||''}</div>
        <div class="section">
          <div class="section-title">Experiencia Laboral</div>
          ${experienciaHTML}
        </div>
        <div class="section">
          <div class="section-title">Educación</div>
          ${educacionHTML}
        </div>
      </div>
    </div>
    </body></html>`;
  }
}
