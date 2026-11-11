/* SisKEN — laporan.js (edit di sini) */
/* ============================================================
   MODUL LAPORAN BULANAN
   ============================================================ */

/* Bulan lama mungkin di luar julat data yang dimuat — minta daripada pelayan dahulu */
async function pilihBulanLaporan(v){
  if(!/^\d{4}-\d{2}$/.test(v)) return;
  rptBulan = v;
  await pastikanData(v + "-01");
  render();
}

/* Cetak / simpan sebagai PDF. Dialog cetak pelayar menyediakan pilihan
   "Save as PDF" / "Microsoft Print to PDF" — tiada perisian tambahan diperlukan.
   Halaman sentiasa A4 MELINTANG (ditetapkan di sini); susun atur cetakan dalam style.css. */
function cetakLaporan(){
  let st = $("print-page");
  if(!st){ st = document.createElement("style"); st.id = "print-page"; document.head.appendChild(st); }
  st.textContent = "@page{ size: A4 landscape; margin: 12mm 11mm 14mm; }";
  /* Tajuk dokumen menjadi nama fail PDF yang dicadangkan oleh pelayar */
  document.title = `Laporan SisKEN ${rptBulan}`;
  const pulih = () => { kemasTajuk(); window.removeEventListener("afterprint", pulih); };
  window.addEventListener("afterprint", pulih);
  window.print();
}

function renderLaporan(){
  const bln = bookings.filter(b => b.tarikh.startsWith(rptBulan));
  const aktif = bln.filter(b => b.status === "diluluskan" || b.status === "selesai");
  const sel = maintenance.filter(s => s.tarikh.startsWith(rptBulan) && s.status !== "dijadual");
  const kosSel = sel.reduce((t,s) => t + s.kos, 0);
  const jmlJam = aktif.reduce((t,b) => t + jamTempahan(b), 0);

  /* Penggunaan kenderaan */
  const vUse = vehicles.map(v => {
    const trips = aktif.filter(b => b.vehicleId === v.id);
    return { v, trips: trips.length, jam: trips.reduce((t,b) => t + jamTempahan(b), 0) };
  }).filter(u => u.v.status !== "dipadam" || u.trips > 0).sort((a,b) => b.trips - a.trips);

  /* Tugasan pemandu */
  const dUse = drivers.map(d => {
    const trips = aktif.filter(b => b.driverId === d.id);
    return { d, trips: trips.length, jam: trips.reduce((t,b) => t + jamTempahan(b), 0) };
  }).filter(u => u.d.status !== "dipadam" || u.trips > 0).sort((a,b) => b.trips - a.trips);

  /* Tempahan mengikut bahagian */
  const bhg = {};
  bln.forEach(b => { const k = b.bahagian || "—"; bhg[k] = (bhg[k] || 0) + 1; });
  const bhgRows = Object.entries(bhg).sort((a,b) => b[1] - a[1]).map(([nama,n]) =>
    `<tr><td>${esc(nama)}</td><td style="text-align:right;font-weight:700">${n}</td></tr>`).join("")
    || `<tr><td colspan="2" style="text-align:center;color:var(--slate-l);padding:20px">Tiada data.</td></tr>`;

  const selRows = sel.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--slate-l);padding:20px">Tiada kerja selenggaraan bulan ini.</td></tr>`
    : sel.map(s => {
        const v = veh(s.vehicleId);
        return `<tr><td style="white-space:nowrap" class="no-wrap-print">${fmtTarikh(s.tarikh)}</td><td>${v?esc(v.plat):"—"}</td><td>${esc(s.jenis)} — <span class="muted">${esc(s.butiran)}</span><div class="muted" style="font-size:12px">${esc(s.bengkel || "")}</div></td><td class="kos">${rm(s.kos)}</td></tr>`;
      }).join("");

  /* Senarai penuh tempahan bulan ini (ikut tarikh & masa) — untuk pembentangan */
  const senarai = [...bln].sort((a,b) => mulaDT(a) < mulaDT(b) ? -1 : mulaDT(a) > mulaDT(b) ? 1 : 0);
  const senaraiRows = senarai.length === 0
    ? `<tr><td colspan="8" style="text-align:center;color:var(--slate-l);padding:20px">Tiada tempahan bulan ini.</td></tr>`
    : senarai.map((b, i) => {
        const v = veh(b.vehicleId), d = drv(b.driverId);
        return `<tr>
          <td style="text-align:right">${i + 1}</td>
          <td style="white-space:nowrap" class="no-wrap-print">${esc(b.id)}</td>
          <td><span class="no-wrap-print" style="white-space:nowrap">${fmtTarikh(b.tarikh)}</span>${b.tarikhTamat && b.tarikhTamat !== b.tarikh ? `<br><span class="no-wrap-print" style="white-space:nowrap">– ${fmtTarikh(b.tarikhTamat)}</span>` : ""}<div class="muted no-wrap-print" style="font-size:12px;white-space:nowrap">${b.masaTamat ? `${esc(b.masaMula)}–${esc(b.masaTamat)}` : `${esc(b.masaMula)} (belum tamat)`}</div></td>
          <td>${esc(b.pemohon)}<div class="muted" style="font-size:12px">${esc(b.bahagian)}</div></td>
          <td>${esc(b.tujuan)}<div class="muted" style="font-size:12px">📍 ${esc(b.destinasi)}</div>${b.status === "ditolak" && b.sebabTolak ? `<div style="font-size:12px;color:var(--red)">Sebab ditolak: ${esc(b.sebabTolak)}</div>` : ""}</td>
          <td>${v ? `${esc(v.plat)}<div class="muted" style="font-size:12px">${esc(v.model)}</div>` : "—"}</td>
          <td>${d ? esc(d.nama) : "—"}</td>
          <td>${chip(BSTATUS[b.status] || {label: b.status, cls: "gray"})}</td>
        </tr>`;
      }).join("");

  const k = klNow();
  return `
    <div class="print-title">
      <h2>Laporan Bulanan Penggunaan Kenderaan — ${fmtBulan(rptBulan)}</h2>
      <p>PERBADANAN PERPUSTAKAAN AWAM TERENGGANU · Bahagian Khidmat Pengurusan</p>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px" class="no-print">
      <h2 class="sect">Laporan Bulanan — ${fmtBulan(rptBulan)}</h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="month" aria-label="Bulan laporan" style="width:auto" value="${rptBulan}" onchange="pilihBulanLaporan(this.value)">
        <button class="btn btn-dark" onclick="cetakLaporan()">📄 Cetak / Simpan PDF</button>
      </div>
    </div>
    <div class="muted no-print" style="font-size:12px;margin-top:-6px">Untuk muat turun PDF: tekan <b>Cetak / Simpan PDF</b>, kemudian pilih <b>Save as PDF</b> (atau <b>Microsoft Print to PDF</b>) sebagai pencetak. Laporan dicetak pada kertas A4 melintang.</div>
    <div class="rpt-grid">
      <div class="rpt-stat"><div class="v">${bln.length}</div><div class="l">Jumlah Tempahan</div></div>
      <div class="rpt-stat"><div class="v c-green">${bln.filter(b=>b.status==="selesai").length}</div><div class="l">Selesai</div></div>
      <div class="rpt-stat"><div class="v c-amber">${bln.filter(b=>b.status==="diluluskan").length}</div><div class="l">Diluluskan (Aktif)</div></div>
      <div class="rpt-stat"><div class="v c-red">${bln.filter(b=>b.status==="ditolak").length}</div><div class="l">Ditolak</div></div>
      <div class="rpt-stat"><div class="v c-sky">${jmlJam.toFixed(1)}</div><div class="l">Jam Penggunaan</div></div>
      <div class="rpt-stat"><div class="v">${rm(kosSel)}</div><div class="l">Kos Selenggaraan</div></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>🚗 Penggunaan Kenderaan</h3></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Kenderaan</th><th style="text-align:right">Bil. Pergerakan</th><th style="text-align:right">Jumlah Jam</th></tr></thead>
        <tbody>${vUse.map(u => `<tr>
          <td><span class="plat">${esc(u.v.plat)}</span> &nbsp;${esc(u.v.model)}</td>
          <td style="text-align:right;font-weight:700">${u.trips}</td>
          <td style="text-align:right">${u.jam.toFixed(1)} jam</td>
        </tr>`).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--slate-l);padding:20px">Tiada data.</td></tr>`}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>👥 Tugasan Pemandu</h3></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Pemandu</th><th style="text-align:right">Bil. Tugasan</th><th style="text-align:right">Jumlah Jam</th></tr></thead>
        <tbody>${dUse.map(u => `<tr>
          <td>${esc(u.d.nama)}</td>
          <td style="text-align:right;font-weight:700">${u.trips}</td>
          <td style="text-align:right">${u.jam.toFixed(1)} jam</td>
        </tr>`).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--slate-l);padding:20px">Tiada data.</td></tr>`}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>🏢 Tempahan Mengikut Bahagian</h3></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Bahagian / Unit</th><th style="text-align:right">Bil. Tempahan</th></tr></thead>
        <tbody>${bhgRows}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>🔧 Kos Selenggaraan Bulan Ini</h3></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Tarikh</th><th>Kenderaan</th><th>Kerja</th><th style="text-align:right">Kos</th></tr></thead>
        <tbody>${selRows}</tbody>
        ${sel.length ? `<tfoot><tr><td colspan="3">JUMLAH</td><td class="kos">${rm(kosSel)}</td></tr></tfoot>` : ""}
      </table></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>📋 Senarai Tempahan Bulan Ini (${senarai.length})</h3></div>
      <div class="tbl-scroll"><table class="rpt-senarai">
        <thead><tr><th style="text-align:right">Bil.</th><th>No.</th><th>Tarikh & Masa</th><th>Pemohon / Bahagian</th><th>Tujuan & Destinasi</th><th>Kenderaan</th><th>Pemandu</th><th>Status</th></tr></thead>
        <tbody>${senaraiRows}</tbody>
      </table></div>
    </div>
    <div class="print-foot">Dijana daripada SisKEN pada ${fmtTarikh(k.tarikh)}, ${k.masa}${currentUser ? ` oleh ${esc(currentUser.nama)}` : ""}</div>`;
}
