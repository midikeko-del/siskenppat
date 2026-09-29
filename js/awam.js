/* SisKEN — awam.js (edit di sini) */
/* ============================================================
   PAPARAN UMUM (sebelum log masuk)
   ============================================================ */
/* Pelayan tidak dapat dihubungi — jangan paparkan data lama (cth. data penuh sesi admin
   selepas log keluar) atau data contoh; tunjuk paparan kosong + status "Gagal sambung". */
function kosongkanData(){
  bookings = []; drivers = []; vehicles = []; maintenance = [];
  setSync("err");
}

async function mulaApp(){
  if(apiAktif()){
    setSync("loading");
    try{
      const res = await api("awam");
      if(res.ok && res.data){
        bookings = res.data.bookings || [];
        drivers = res.data.drivers || [];
        vehicles = res.data.vehicles || [];
        maintenance = [];
        setSync("ok");
      } else kosongkanData();
    }catch(e){ kosongkanData(); }
  } else setSync("local");
  render();
}

function renderAwam(){
  const akan = bookings
    .filter(b => b.status === "diluluskan" && tarikhTamatEf(b) >= HARI_INI)
    .sort((a,b) => (a.tarikh + a.masaMula).localeCompare(b.tarikh + b.masaMula));

  const rows = akan.length === 0
    ? `<div style="padding:30px;text-align:center;color:var(--slate-l);font-size:14px">Tiada tempahan sedang berjalan buat masa ini.</div>`
    : akan.map(t => {
        const v = veh(t.vehicleId), d = drv(t.driverId);
        return `<div style="padding:14px 20px;border-bottom:1px solid #f8fafc;display:flex;align-items:center;gap:18px;flex-wrap:wrap">
          <div style="min-width:120px">
            <div style="font-weight:700;font-size:13px">${paparTarikh(t)}</div>
            <div style="font-family:Consolas,monospace;font-size:13px;color:var(--slate)">${paparMasa(t)}</div>
          </div>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:600">${esc(t.tujuan)}</div>
            <div class="muted">${esc(t.destinasi)}${t.bahagian ? " · " + esc(t.bahagian) : ""}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${v ? `<span class="plat">${esc(v.plat)}</span>` : ""}
            <span style="font-size:13px;color:var(--slate)">${d ? esc(d.nama) : ""}</span>
            ${chip(BSTATUS[t.status])}
          </div>
        </div>`;
      }).join("");

  const minggu = mingguUntuk(mingguOffsetAwam);
  const head = minggu.map((t,i) =>
    `<th style="${t===HARI_INI?'color:var(--amber-d)':''}">${HARI[i]}<br><span style="font-weight:400;text-transform:none">${fmtTarikh(t)}</span></th>`).join("");
  const gRows = pemanduAktif().map(d => {
    const cells = minggu.map(tarikh => {
      const cls = tarikh === HARI_INI ? "today" : "";
      if(d.status === "cuti") return `<td class="${cls}"><span class="off">Cuti</span></td>`;
      const tugas = bookings.filter(b => b.driverId === d.id && dudukiHari(b, tarikh) && (b.status==="diluluskan"||b.status==="selesai"));
      if(tugas.length === 0) return `<td class="${cls}"><span class="free">Kosong</span></td>`;
      return `<td class="${cls}">${tugas.map(t => {
        const v = veh(t.vehicleId);
        return `<div class="duty"><div class="tm">${paparMasa(t)}</div><div>${esc(t.destinasi)}</div><div class="pl">${v?esc(v.plat):""}</div></div>`;
      }).join("")}</td>`;
    }).join("");
    return `<tr><td style="min-width:180px"><div class="drv-nm">${esc(d.nama)}</div>
      <span class="toggle ${d.status==='bertugas'?'on':'off2'}" style="margin-top:6px;display:inline-block">${d.status==='bertugas'?'● Bertugas':'○ Cuti'}</span></td>${cells}</tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="card-h"><h3>🛣️ Tempahan Sedang Berjalan & Akan Datang</h3><span class="muted">Hari ini: ${fmtTarikh(HARI_INI)}</span></div>
      ${rows}
    </div>
    <div class="card">
      <div class="card-h">
        <h3>👥 Jadual Pemandu</h3>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="muted">${fmtTarikh(minggu[0])} – ${fmtTarikh(minggu[6])}</span>
          <button class="btn btn-dark" style="padding:6px 12px;font-size:16px;line-height:1" onclick="mingguNavAwam(-1)" title="Minggu sebelum">‹</button>
          <button class="btn ${mingguOffsetAwam===0?'btn-dark':'btn-amber'}" style="padding:7px 12px" onclick="mingguIniAwam()">Minggu Ini</button>
          <button class="btn btn-dark" style="padding:6px 12px;font-size:16px;line-height:1" onclick="mingguNavAwam(1)" title="Minggu seterusnya">›</button>
        </div>
      </div>
      <div class="tbl-scroll"><table class="sched"><thead><tr><th>Pemandu</th>${head}</tr></thead><tbody>${gRows}</tbody></table></div>
    </div>`;
}
function mingguNavAwam(delta){ mingguOffsetAwam += delta; render(); }
function mingguIniAwam(){ mingguOffsetAwam = 0; render(); }
