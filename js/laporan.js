/* SisKEN — laporan.js (edit di sini) */
/* ============================================================
   MODUL LAPORAN BULANAN
   ============================================================ */
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
  }).sort((a,b) => b.trips - a.trips);

  /* Tugasan pemandu */
  const dUse = drivers.map(d => {
    const trips = aktif.filter(b => b.driverId === d.id);
    return { d, trips: trips.length, jam: trips.reduce((t,b) => t + jamTempahan(b), 0) };
  }).sort((a,b) => b.trips - a.trips);

  /* Tempahan mengikut bahagian */
  const bhg = {};
  bln.forEach(b => { bhg[b.bahagian] = (bhg[b.bahagian] || 0) + 1; });
  const bhgRows = Object.entries(bhg).sort((a,b) => b[1] - a[1]).map(([nama,n]) =>
    `<tr><td>${esc(nama)}</td><td style="text-align:right;font-weight:700">${n}</td></tr>`).join("")
    || `<tr><td colspan="2" style="text-align:center;color:var(--slate-l);padding:20px">Tiada data.</td></tr>`;

  const selRows = sel.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--slate-l);padding:20px">Tiada kerja selenggaraan bulan ini.</td></tr>`
    : sel.map(s => {
        const v = veh(s.vehicleId);
        return `<tr><td style="white-space:nowrap">${fmtTarikh(s.tarikh)}</td><td>${v?esc(v.plat):"—"}</td><td>${esc(s.jenis)} — <span class="muted">${esc(s.butiran)}</span></td><td class="kos">${rm(s.kos)}</td></tr>`;
      }).join("");

  return `
    <div class="print-title">
      <h2>Laporan Bulanan Penggunaan Kenderaan</h2>
      <p>PERBADANAN PERPUSTAKAAN AWAM TERENGGANU · Bahagian Khidmat Pengurusan · ${fmtBulan(rptBulan)}</p>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px" class="no-print">
      <h2 class="sect">Laporan Bulanan — ${fmtBulan(rptBulan)}</h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="month" style="width:auto" value="${rptBulan}" onchange="rptBulan=this.value;render()">
        <button class="btn btn-dark" onclick="window.print()">🖨 Cetak Laporan</button>
      </div>
    </div>
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
        </tr>`).join("")}</tbody>
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
        </tr>`).join("")}</tbody>
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
    </div>`;
}
