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

      // Verificar límite de descargas del día
      const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const claveContador = `descargas:${uid}:${hoy}`;
      const descargasHoy = parseInt(await redis.get(claveContador) || '0');
      const limiteDia = pago.limiteDia || 3;

      if (descargasHoy >= limiteDia) {
        return res.status(429).json({ 
          error: `Límite de ${limiteDia} descargas por día alcanzado. Vuelve mañana.` 
        });
      }

      // Usar CV congelado al momento del pago (no el CV actual)
      const cvRaw = await redis.get(`cv:pagado:${uid}`) || await redis.get(`cv:usuario:${uid}`);
      if (!cvRaw) return res.status(404).json({ error: 'CV no encontrado. Genera tu CV de nuevo.' });
      const parsed = typeof cvRaw === 'string' ? JSON.parse(cvRaw) : cvRaw;
      cvData = parsed.cvData;
      habilidades = parsed.habilidades || [];
      blandasData = parsed.blandasData || [];
      foto = parsed.foto || null;
      estilo = estiloParam || parsed.estilo || 'clasico';

      // Incrementar contador de descargas del día (expira en 25 horas)
      await redis.setex(claveContador, 60 * 60 * 25, String(descargasHoy + 1));
      console.log(`Descarga ${descargasHoy + 1}/${limiteDia} para ${uid} hoy`);

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
    const response = await fetch(`https://production-sfo.browserless.io/chromium/pdf?token=${process.env.BROWSERLESS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html),
        options: {
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', right: '0mm', bottom: '10mm', left: '0mm' },
          tagged: false
        },
        gotoOptions: { waitUntil: 'load', timeout: 15000 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Browserless error:', response.status, err);
      return res.status(500).json({ error: 'Error generando PDF: ' + err });
    }

    console.log('Browserless OK - Content-Type:', response.headers.get('content-type'));
    const pdfBuffer = await response.arrayBuffer();
    console.log('PDF size:', pdfBuffer.byteLength, 'bytes');
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
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=210mm">
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
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=210mm">
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
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=210mm">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background:white; }
      .cv { display:grid; grid-template-columns:240px 1fr; min-height:100%; }
      .sidebar { background:#1a1a2e; color:white; padding:32px 20px; min-height:100vh; }
      @page { margin: 0; }
      html, body { height: 100%; }
      .cv-wrap { min-height: 100vh; display: flex; flex-direction: column; }
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
    </style></head><body style="margin:0;padding:0;min-height:100vh;">
    <div class="cv" style="min-height:100vh;align-items:stretch;">
      <div class="sidebar" style="min-height:100vh;">
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

  // ESTILO MODERNO2 — dos columnas sidebar azul marino profesional
  if (estilo === 'moderno2') {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background:white; }
      .cv { display:grid; grid-template-columns:200px 1fr; min-height:100vh; }
      .sidebar { background:#1e3a5f; color:white; padding:28px 18px; }
      .foto-wrap { text-align:center; margin-bottom:16px; }
      .foto-wrap img { width:80px; height:80px; border-radius:50%; object-fit:cover; border:2px solid rgba(255,255,255,0.3); }
      .foto-initials { width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:24px; margin:0 auto; }
      .nombre-sidebar { font-size:13px; font-weight:700; color:white; text-align:center; margin-bottom:16px; }
      .section-label { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:rgba(255,255,255,0.5); margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.15); margin-top:14px; }
      .contact-item { font-size:10px; color:rgba(255,255,255,0.8); margin-bottom:5px; }
      .skill-tag { display:inline-block; background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); padding:2px 8px; border-radius:10px; font-size:9px; margin:2px; }
      .soft-tag { display:inline-block; background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.8); padding:2px 8px; border-radius:10px; font-size:9px; margin:2px; }
      .main { padding:28px 32px; }
      .nombre-main { font-size:22px; font-weight:900; color:#1e3a5f; margin-bottom:4px; }
      .divider { width:50px; height:3px; background:#1e3a5f; border-radius:2px; margin-bottom:14px; }
      .perfil { font-size:11px; color:#4a5568; line-height:1.7; margin-bottom:20px; }
      .section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#1e3a5f; margin-bottom:10px; padding-bottom:4px; border-bottom:2px solid #1e3a5f; }
      .section { margin-bottom:20px; page-break-inside:avoid; }
      .exp-cargo { font-size:12px; font-weight:700; color:#1e3a5f; }
      .exp-empresa { font-size:10px; color:#2d5986; font-weight:600; }
      .exp-periodo { font-size:10px; color:#718096; margin-bottom:4px; }
      .exp-logro { font-size:10px; color:#4a5568; margin-left:10px; margin-bottom:3px; }
      .edu-titulo { font-size:11px; font-weight:700; color:#1e3a5f; }
      .edu-inst { font-size:10px; color:#2d5986; }
      .edu-año { font-size:10px; color:#718096; }
    </style></head><body>
    <div class="cv">
      <div class="sidebar">
        <div class="foto-wrap">${fotoHTML}</div>
        <div class="nombre-sidebar">${cv.nombre||''}</div>
        <div class="section-label">Contacto</div>
        ${cv.email?`<div class="contact-item">📧 ${cv.email}</div>`:''}
        ${cv.telefono?`<div class="contact-item">📱 ${cv.telefono}</div>`:''}
        ${skills?`<div class="section-label">Habilidades Técnicas</div><div style="margin-bottom:8px;">${skills}</div>`:''}
        ${softSkills?`<div class="section-label">Habilidades Blandas</div><div>${softSkills}</div>`:''}
      </div>
      <div class="main">
        <div class="nombre-main">${cv.nombre||''}</div>
        <div class="divider"></div>
        <div class="perfil">${cv.perfil||''}</div>
        <div class="section"><div class="section-title">Experiencia Laboral</div>${experienciaHTML}</div>
        <div class="section"><div class="section-title">Educación</div>${educacionHTML}</div>
      </div>
    </div>
    </body></html>`;
  }

  // ESTILO CRONOLÓGICO — una columna simple y directa
  if (estilo === 'cronologico') {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background:white; }
      .header { padding:24px 40px 16px; border-bottom:3px solid #374151; display:flex; align-items:center; gap:20px; }
      .foto-wrap img { width:70px; height:70px; border-radius:50%; object-fit:cover; border:2px solid #374151; }
      .foto-initials { width:70px; height:70px; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
      .header-info { flex:1; }
      .nombre { font-size:24px; font-weight:900; color:#111827; margin-bottom:4px; }
      .contacto { display:flex; flex-wrap:wrap; gap:12px; }
      .contacto span { font-size:10px; color:#374151; }
      .main { padding:20px 40px; }
      .section-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#111827; border-bottom:1.5px solid #374151; padding-bottom:4px; margin-bottom:12px; margin-top:18px; }
      .skills-row { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px; }
      .skill-tag { background:#f1f5f9; color:#1e293b; border:1px solid #e2e8f0; padding:2px 8px; border-radius:4px; font-size:10px; }
      .soft-tag { background:#f1f5f9; color:#1e293b; border:1px solid #e2e8f0; padding:2px 8px; border-radius:4px; font-size:10px; }
      .perfil { font-size:11px; color:#4a5568; line-height:1.7; }
      .exp-cargo { font-size:12px; font-weight:700; color:#111827; }
      .exp-empresa { font-size:10px; color:#374151; font-weight:600; }
      .exp-periodo { font-size:10px; color:#718096; margin-bottom:4px; }
      .exp-logro { font-size:10px; color:#4a5568; margin-left:10px; margin-bottom:3px; }
      .edu-titulo { font-size:11px; font-weight:700; color:#111827; }
      .edu-inst { font-size:10px; color:#374151; }
      .edu-año { font-size:10px; color:#718096; }
    </style></head><body>
    <div class="header">
      <div class="foto-wrap">${fotoHTML}</div>
      <div class="header-info">
        <div class="nombre">${cv.nombre||''}</div>
        <div class="contacto">
          ${cv.email?`<span>📧 ${cv.email}</span>`:''}
          ${cv.telefono?`<span>📱 ${cv.telefono}</span>`:''}
        </div>
      </div>
    </div>
    <div class="main">
      <div class="section-title">Perfil Profesional</div>
      <div class="perfil">${cv.perfil||''}</div>
      ${skills||softSkills?`<div class="section-title">Habilidades</div><div class="skills-row">${skills}${softSkills}</div>`:''}
      <div class="section-title">Experiencia Laboral</div>
      ${experienciaHTML}
      <div class="section-title">Educación</div>
      ${educacionHTML}
    </div>
    </body></html>`;
  }

}
