/* SisKEN — log.js (edit di sini) */
/* ============================================================
   LOG AUDIT (admin sahaja) — siapa buat apa, bila
   ============================================================ */
function renderLog(){
  if(!apiAktif() || !TOKEN){
    return `<h2 class="sect">Log Audit</h2>
      <div class="card"><div style="padding:30px;color:var(--slate);font-size:14px;line-height:1.7">
        Modul ini memerlukan sambungan Google Sheets dan log masuk sebenar.
      </div></div>`;
  }
  setTimeout(muatLog, 0); // muat data selepas paparan dipasang
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Log Audit</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-dark" onclick="muatLog()">↻ Muat Semula</button>
        <button class="btn" style="border:1px solid var(--red-line);color:var(--red)" onclick="padamLogLama()">🗑 Padam log &gt;1 tahun</button>
      </div>
    </div>
    <div class="card"><div class="tbl-scroll"><table>
      <thead><tr><th>Masa</th><th>Pengguna</th><th>Tindakan</th><th>Tempahan</th><th>Butiran</th></tr></thead>
      <tbody id="log-body"><tr><td colspan="5" style="padding:24px;text-align:center;color:var(--slate-l)">Memuatkan…</td></tr></tbody>
    </table></div></div>
    <div class="muted" style="padding:4px 2px">Memaparkan 200 rekod terkini. Rekod penuh ada dalam helaian "Log" Google Sheet.</div>`;
}

async function muatLog(){
  const b = $("log-body");
  if(!b) return;
  try{
    const res = await api("auditLog");
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){ b.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--red)">${esc(res.ralat||"Gagal memuatkan log.")}</td></tr>`; return; }
    const rows = res.log || [];
    b.innerHTML = rows.length
      ? rows.map(r => `<tr>
          <td style="white-space:nowrap;font-family:Consolas,monospace;font-size:12px">${esc(r.masa)}</td>
          <td style="font-weight:600">${esc(r.userId)}</td>
          <td>${esc(r.tindakan)}</td>
          <td style="font-family:Consolas,monospace">${esc(r.tempahanId)}</td>
          <td class="muted">${esc(r.butiran)}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--slate-l)">Tiada log lagi.</td></tr>`;
  }catch(e){
    b.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--red)">Gagal menghubungi pelayan.</td></tr>`;
  }
}

function padamLogLama(){
  confirmModal("Padam Log Lama",
    `Padam semua rekod log audit yang melebihi <b>1 tahun</b>? Rekod dalam tempoh setahun terakhir akan dikekalkan. Tindakan ini tidak boleh dibatalkan.`,
    async () => {
      try{
        const res = await api("logPurge");
        if(res.sesiTamat){ sesiTamat(); return; }
        if(!res.ok){ closeModal(); notify(res.ralat || "Gagal memadam log."); return; }
        closeModal(); muatLog(); notify(`${res.dibuang} rekod log lama dipadam.`);
      }catch(e){ closeModal(); notify("Gagal menghubungi pelayan."); }
    }, "🗑 Ya, Padam", "btn-red");
}
