/* SisKEN — dashboard.js (edit di sini) */
/* ---------- PAPAN PEMUKA ---------- */
function renderDashboard(){
  const s = {
    tersedia: kenderaanAktif().filter(v=>statusKenderaan(v)==="tersedia").length,
    jalan: kenderaanAktif().filter(v=>statusKenderaan(v)==="dalam_perjalanan").length,
    sel: kenderaanAktif().filter(v=>statusKenderaan(v)==="selenggara").length,
    tunggu: bookings.filter(b=>b.status==="menunggu").length,
  };
  const trips = bookings.filter(b => dudukiHari(b, HARI_INI) && (b.status==="diluluskan" || b.status==="selesai"));

  const fleetRows = kenderaanAktif().map(v => {
    const trip = trips.find(t => t.vehicleId === v.id && t.status === "diluluskan");
    const d = trip ? drv(trip.driverId) : null;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:12px">
        <span class="plat">${esc(v.plat)}</span>
        <div><div style="font-weight:600">${esc(v.model)}</div><div class="muted">${esc(v.jenis)}</div></div>
      </div></td>
      <td>${chip(VSTATUS[statusKenderaan(v)])}</td>
      <td style="color:var(--slate)">📍 ${esc(v.lokasi)}</td>
      <td style="color:var(--slate)">${trip ? `${esc(d.nama)} · <span class="muted">${esc(trip.destinasi)}</span>` : '<span style="color:#cbd5e1">—</span>'}</td>
    </tr>`;
  }).join("");

  const tripRows = trips.length === 0
    ? `<div style="padding:32px;text-align:center;color:var(--slate-l);font-size:14px">Tiada pergerakan dijadualkan hari ini.</div>`
    : trips.map(t => {
        const v = veh(t.vehicleId), d = drv(t.driverId);
        return `<div style="padding:14px 20px;border-bottom:1px solid #f8fafc;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
          <span style="font-family:Consolas,monospace;font-weight:700;width:96px">${paparMasa(t)}</span>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:600">${esc(t.tujuan)}</div>
            <div class="muted">${esc(t.destinasi)} · ${esc(t.pemohon)}, ${esc(t.bahagian)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${v ? `<span class="plat">${esc(v.plat)}</span>` : ""}
            <span style="font-size:13px;color:var(--slate)">${d ? esc(d.nama) : ""}</span>
            ${chip(BSTATUS[t.status])}
            ${t.status === "diluluskan" ? `<button class="btn-sm" onclick="complete('${t.id}')">Tanda Selesai</button>` : ""}
          </div>
        </div>`;
      }).join("");

  return `
    <div class="stats">
      <div class="stat"><span class="ic">✅</span><div><div class="v c-green">${s.tersedia}</div><div class="l">Kenderaan Tersedia</div></div></div>
      <div class="stat"><span class="ic">🛣️</span><div><div class="v c-amber">${s.jalan}</div><div class="l">Dalam Perjalanan</div></div></div>
      <div class="stat"><span class="ic">🔧</span><div><div class="v c-red">${s.sel}</div><div class="l">Dalam Selenggaraan</div></div></div>
      <div class="stat"><span class="ic">⏳</span><div><div class="v c-sky">${s.tunggu}</div><div class="l">Tempahan Menunggu</div></div></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>📍 Papan Keberadaan Kenderaan</h3><span class="muted">Kemas kini: ${klNow().masa}</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Kenderaan</th><th>Status</th><th>Lokasi Semasa</th><th>Pemandu / Tugasan</th></tr></thead>
        <tbody>${fleetRows}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>🛣️ Pergerakan Hari Ini — ${fmtTarikh(HARI_INI)}</h3></div>
      ${tripRows}
    </div>`;
}
