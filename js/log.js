/* SisKEN — log.js (edit di sini) */
/* ============================================================
   LOG AUDIT (admin sahaja) — siapa buat apa, bila
   ============================================================ */
function renderLog(){
  if(!apiAktif() || !TOKEN){
    return `<h2 class="sect">Log Audit</h2>
      <div class="card"><div style="padding:30px;color:var(--slate);font-size:14px;line-height:1.7">
        Modul ini memerlukan sambungan pelayan (backend PHP) dan log masuk sebenar.
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
    <div class="muted" style="padding:4px 2px">Memaparkan 200 rekod terkini. Rekod penuh ada dalam jadual <code>log</code> pangkalan data MySQL.</div>`;
}

/* Tukar butiran kelulusan ID → nama mudah baca.
   "K4 / P1" → "VHQ 2236 (Toyota Hilux) / En. Azman bin Hashim".
   Jika ID tak dapat dipadan (cth rekod lama dah tiada), kekalkan nilai asal. */
function butiranLulus(s){
  const m = /^\s*(\S+)\s*\/\s*(\S+)\s*$/.exec(String(s || ""));
  if(!m) return esc(s);                       // bukan format "ID / ID" — papar asal
  const v = veh(m[1]), d = drv(m[2]);
  if(!v && !d) return esc(s);                 // tiada padanan langsung — papar asal
  const vTxt = v ? `${v.plat} (${v.model})` : m[1];
  const dTxt = d ? d.nama : m[2];
  return `${esc(vTxt)} <span class="muted">/</span> ${esc(dTxt)}`;
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
          <td class="muted">${r.tindakan === "Lulus" ? butiranLulus(r.butiran) : esc(r.butiran)}</td>
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
