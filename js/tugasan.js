/* SisKEN — tugasan.js (edit di sini) */
function renderTugasan(){
  const me = currentUser.driverId;
  if(!me) return `<h2 class="sect">Tugasan Saya</h2>
    <div class="card"><div style="padding:30px;color:var(--slate);font-size:14px;line-height:1.7">
      Akaun anda belum dipautkan kepada mana-mana rekod pemandu.<br>Sila hubungi admin untuk memautkan akaun ini kepada rekod pemandu anda.
    </div></div>`;

  const semua = bookings
    .filter(b => b.driverId === me && (b.status === "diluluskan" || b.status === "selesai"))
    .sort((a,b) => (a.tarikh + a.masaMula).localeCompare(b.tarikh + b.masaMula));
  const aktif = semua.filter(b => b.status === "diluluskan");
  const sejarah = semua.filter(b => b.status === "selesai").reverse().slice(0, 10);

  const kad = (t, butang) => {
    const v = veh(t.vehicleId);
    return `<div class="bk">
      <div style="flex:1;min-width:240px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="id">${t.id}</span>${chip(BSTATUS[t.status])}</div>
        <h4>${esc(t.tujuan)}</h4>
        <div class="meta">📍 ${esc(t.destinasi)} &nbsp;·&nbsp; ${paparTarikh(t)}, ${paparMasa(t)} &nbsp;·&nbsp; ${t.penumpang} penumpang</div>
        <div class="who">${esc(t.pemohon || "")}${t.bahagian ? " — " + esc(t.bahagian) : ""}</div>
        ${v ? `<div class="assign"><span class="plat">${esc(v.plat)}</span> ${esc(v.model)}</div>` : ""}
        ${t.masaSelesai ? `<div class="who" style="color:var(--green);margin-top:6px">✔ Selesai sebenar: ${fmtMasaSelesai(t.masaSelesai)}</div>` : ""}
      </div>
      ${butang ? `<div><button class="btn btn-green" style="flex:none" onclick="siapTugas('${t.id}')">✔ Tandakan Selesai</button></div>` : ""}
    </div>`;
  };

  const saya = drv(me);
  const statusPanel = saya ? `
    <div class="card"><div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-weight:700">Status Saya: ${saya.status === "bertugas" ? "Bertugas" : "Cuti"}</div>
        <div class="muted">Status ini dikemas kini secara langsung pada jadual pemandu dan paparan umum.</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${chip(saya.status === "bertugas" ? {label:"● Bertugas", cls:"green"} : {label:"○ Cuti", cls:"gray"})}
        <button class="btn ${saya.status === "bertugas" ? "btn-dark" : "btn-amber"}" onclick="tukarStatusSaya()">
          ${saya.status === "bertugas" ? "Tukar ke Cuti" : "Tukar ke Bertugas"}
        </button>
      </div>
    </div></div>` : "";

  return `
    <h2 class="sect">Tugasan Saya — ${esc(saya ? saya.nama : currentUser.nama)}</h2>
    ${statusPanel}
    ${aktif.length === 0
      ? `<div class="card" style="padding:32px;text-align:center;color:var(--slate-l)">Tiada tugasan aktif buat masa ini. 👍</div>`
      : `<div style="display:grid;gap:14px">${aktif.map(t => kad(t, true)).join("")}</div>`}
    ${sejarah.length ? `<h2 class="sect" style="margin-top:8px">Sejarah Selesai (10 terkini)</h2>
      <div style="display:grid;gap:14px">${sejarah.map(t => kad(t, false)).join("")}</div>` : ""}`;
}

async function tukarStatusSaya(){
  const d = drv(currentUser.driverId);
  if(!d) return;
  const baru = d.status === "bertugas" ? "cuti" : "bertugas";
  d.status = baru;
  render();
  if(apiAktif() && TOKEN){
    setSync("saving");
    try{
      const res = await api("drvStatus", { status: baru });
      if(res.sesiTamat){ sesiTamat(); return; }
      if(!res.ok){
        d.status = baru === "bertugas" ? "cuti" : "bertugas"; // kembalikan jika gagal
        render(); setSync("err"); notify(res.ralat || "Gagal mengemas kini status.");
        return;
      }
      setSync("ok");
    }catch(e){
      d.status = baru === "bertugas" ? "cuti" : "bertugas";
      render(); setSync("err"); notify("Gagal menghubungi pelayan.");
      return;
    }
  }
  notify(baru === "bertugas" ? "Status anda kini: Bertugas." : "Status anda kini: Cuti.");
}

/* Borang selesai tugasan — pemandu WAJIB kemas kini odometer, bahan api & lokasi */
function siapTugas(id){
  const t = bookings.find(b => b.id === id);
  const v = veh(t.vehicleId);
  const odoMin = v ? v.odometer : 0;
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:480px">
      <div class="modal-h"><h3>Selesai Tugasan ${t.id}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="summary"><b>${esc(t.destinasi)}</b><br><span class="muted">${v ? esc(v.plat) + " — " + esc(v.model) : "Tiada kenderaan"}</span></div>
        <p class="muted" style="font-size:13px;line-height:1.6">Sila kemas kini keadaan kenderaan selepas perjalanan. Masa selesai direkod automatik oleh pelayan.</p>
        <div class="row2">
          <label class="fld"><span>Odometer (km)</span><input type="number" id="sp-odo" value="${v ? v.odometer : ""}" min="${odoMin}" oninput="checkSiap(${odoMin})"></label>
          <label class="fld"><span>Bahan Api (%)</span><input type="number" id="sp-fuel" value="${v ? v.bahanApi : ""}" min="0" max="100" oninput="checkSiap(${odoMin})"></label>
        </div>
        <label class="fld"><span>Lokasi Semasa Kenderaan</span><input id="sp-lok" value="${v ? esc(v.lokasi) : ""}" placeholder="cth: Garaj Utama, Aras B1" oninput="checkSiap(${odoMin})"></label>
        <div id="sp-err"></div>
        <button class="btn btn-green" id="sp-ok" style="justify-content:center" onclick="hantarSiap('${t.id}')">✔ Selesai & Kemas Kini Kenderaan</button>
      </div>
    </div>
  </div>`;
  checkSiap(odoMin);
}

function checkSiap(odoMin){
  const odoVal = $("sp-odo").value, fuelVal = $("sp-fuel").value, lok = $("sp-lok").value.trim();
  const odo = parseInt(odoVal), fuel = parseInt(fuelVal);
  let err = "";
  if(odoVal !== "" && !isNaN(odo) && odo < odoMin)
    err = `Odometer tidak boleh kurang daripada bacaan semasa (${odoMin.toLocaleString()} km).`;
  $("sp-err").innerHTML = err ? `<span class="err">${err}</span>` : "";
  const valid = odoVal !== "" && !isNaN(odo) && odo >= odoMin &&
                fuelVal !== "" && fuel >= 0 && fuel <= 100 && lok;
  $("sp-ok").disabled = !valid;
}

async function hantarSiap(id){
  const t = bookings.find(b => b.id === id);
  const odo = parseInt($("sp-odo").value), fuel = parseInt($("sp-fuel").value), lok = $("sp-lok").value.trim();

  /* Mod demo / tiada API: kemas kini setempat */
  if(!apiAktif() || !TOKEN){
    t.status = "selesai"; t.masaSelesai = skrgStr();
    const [tkhS, msS] = t.masaSelesai.split(" ");
    if(!t.masaTamat) t.masaTamat = msS;
    if(tkhS !== t.tarikh) t.tarikhTamat = tkhS;
    const v = veh(t.vehicleId); if(v){ v.odometer = odo; v.bahanApi = fuel; v.lokasi = lok; }
    closeModal(); render(); notify(`Tugasan ${id} selesai (mod tempatan).`); return;
  }

  const btn = $("sp-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";
  setSync("saving");
  try{
    const res = await api("bookingComplete", { id, odometer: odo, bahanApi: fuel, lokasi: lok });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("sp-err").innerHTML = `<span class="err">${esc(res.ralat || "Gagal menyelesaikan tugasan.")}</span>`;
      btn.disabled = false; btn.textContent = "✔ Selesai & Kemas Kini Kenderaan"; setSync("err"); return;
    }
    Object.assign(t, res.booking);
    if(res.vehicle){ const v = veh(t.vehicleId); if(v) Object.assign(v, res.vehicle); }
    setSync("ok"); closeModal(); render(); notify(`Tugasan ${id} selesai. Terima kasih!`);
  }catch(e){
    $("sp-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "✔ Selesai & Kemas Kini Kenderaan"; setSync("err");
  }
}
