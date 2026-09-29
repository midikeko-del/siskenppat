/* SisKEN — kenderaan.js (edit di sini) */
/* ---------- KENDERAAN ---------- */
function renderKenderaan(){
  const cards = kenderaanAktif().map(v => {
    const taxWarn = v.roadtax <= tambahHari(HARI_INI, 60); // tamat dalam 60 hari / sudah tamat
    const taxTamat = v.roadtax < HARI_INI;                 // sudah luput
    return `<div class="veh">
      <div class="veh-top">
        <div>
          <span class="plat">${esc(v.plat)}</span>
          <h4>${esc(v.model)}</h4>
          <div class="typ">${esc(v.jenis)} · ${v.kapasiti} tempat duduk</div>
        </div>
        ${chip(VSTATUS[statusKenderaan(v)])}
      </div>
      <div class="veh-stats">
        <div class="vs"><div class="n">${v.odometer.toLocaleString()} km</div><div class="t">Odometer</div></div>
        <div class="vs"><div class="n">${v.bahanApi}%</div><div class="t">Bahan Api</div></div>
        <div class="vs ${taxWarn?'warn':''}"><div class="n">${fmtTarikh(v.roadtax)}</div><div class="t">Cukai Jalan</div></div>
      </div>
      ${taxWarn ? `<div class="alert">⚠️ ${taxTamat ? "Cukai jalan TELAH TAMAT" : "Cukai jalan hampir tamat"} — sila perbaharui.</div>` : ""}
      <label class="fld"><span>Lokasi Semasa</span>
        <input value="${esc(v.lokasi)}" onchange="updVehicle('${v.id}','lokasi',this.value)">
      </label>
      <label class="fld"><span>Status <span style="text-transform:none;font-weight:400">(Tersedia/Dalam Perjalanan dikira automatik)</span></span>
        <select onchange="updVehicle('${v.id}','status',this.value)">
          <option value="tersedia" ${v.status!=="selenggara"?"selected":""}>Bersedia</option>
          <option value="selenggara" ${v.status==="selenggara"?"selected":""}>Selenggaraan</option>
        </select>
      </label>
      <div class="act-row">
        <button class="btn-edit" onclick="openVehForm('${v.id}')">✎ Edit</button>
        <button class="btn-edit" style="border-color:var(--line);color:var(--slate)" onclick="selFilter='${v.id}';setTab('selenggara')">🔧 Sejarah</button>
        <button class="btn-del" onclick="askDelVehicle('${v.id}')">🗑 Padam</button>
      </div>
    </div>`;
  }).join("");

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Pengurusan Kenderaan</h2>
      <button class="btn btn-amber" onclick="openVehForm()">＋ Tambah Kenderaan</button>
    </div>
    <div class="fleet">${cards}</div>`;
}

/* ================= TINDAKAN ================= */
/* Kemas kini SATU medan sahaja (lokasi/status) — medan lain di server tidak disentuh */
function updVehicle(id, key, val){
  simpanRekod("vehicleSave", { vehicle: { id, [key]: val } }, () => { veh(id)[key] = val; });
}

/* ============================================================
   TAMBAH / EDIT / PADAM KENDERAAN
   ============================================================ */
function openVehForm(id){
  editVehId = id || null;
  const v = id ? veh(id) : null;
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-h"><h3>${v ? "Edit Kenderaan — " + esc(v.plat) : "Tambah Kenderaan Baharu"}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="row2">
          <label class="fld"><span>No. Pendaftaran (Plat)</span><input id="v-plat" value="${v?esc(v.plat):""}" placeholder="cth: WXY 1234" oninput="checkVehForm()"></label>
          <label class="fld"><span>Model</span><input id="v-model" value="${v?esc(v.model):""}" placeholder="cth: Toyota Hiace" oninput="checkVehForm()"></label>
        </div>
        <div class="row2">
          <label class="fld"><span>Jenis</span>
            <select id="v-jenis">
              <option ${v&&v.jenis==="Kereta Pejabat"?"selected":""}>Kereta Pejabat</option>
              <option ${v&&v.jenis==="Kenderaan Rasmi"?"selected":""}>Kenderaan Rasmi</option>
              <option ${v&&v.jenis==="Van Jabatan"?"selected":""}>Van Jabatan</option>
              <option ${v&&v.jenis==="Pacuan 4 Roda"?"selected":""}>Pacuan 4 Roda</option>
              <option ${v&&v.jenis==="Bas Jabatan"?"selected":""}>Bas Jabatan</option>
              <option ${v&&v.jenis==="Lori / Pickup"?"selected":""}>Lori / Pickup</option>
            </select>
          </label>
          <label class="fld"><span>Kapasiti (tempat duduk)</span><input type="number" id="v-kapasiti" value="${v?v.kapasiti:5}" min="1" max="44" oninput="checkVehForm()"></label>
        </div>
        <div class="row2">
          <label class="fld"><span>Odometer (km)</span><input type="number" id="v-odo" value="${v?v.odometer:0}" min="0"></label>
          <label class="fld"><span>Bahan Api (%)</span><input type="number" id="v-fuel" value="${v?v.bahanApi:100}" min="0" max="100"></label>
        </div>
        <div class="row2">
          <label class="fld"><span>Tamat Cukai Jalan</span><input type="date" id="v-tax" value="${v?v.roadtax:""}" oninput="checkVehForm()"></label>
          <label class="fld"><span>Status</span>
            <select id="v-status">
              <option value="tersedia" ${!v||v.status!=="selenggara"?"selected":""}>Bersedia</option>
              <option value="selenggara" ${v&&v.status==="selenggara"?"selected":""}>Selenggaraan</option>
            </select>
          </label>
        </div>
        <label class="fld"><span>Lokasi Semasa</span><input id="v-lokasi" value="${v?esc(v.lokasi):"Garaj Utama, Aras B1"}"></label>
        <div id="v-err"></div>
        <button class="btn btn-amber" id="v-ok" style="justify-content:center" onclick="submitVeh(${v?`'${v.id}'`:"null"})">
          ${v ? "Simpan Perubahan" : "Tambah Kenderaan"}
        </button>
      </div>
    </div>
  </div>`;
  checkVehForm();
}

function checkVehForm(){
  const plat = $("v-plat").value.trim();
  const dup = vehicles.some(v => v.plat.toLowerCase() === plat.toLowerCase() && v.id !== editVehId);
  const valid = plat && $("v-model").value.trim() && $("v-tax").value && parseInt($("v-kapasiti").value) > 0 && !dup;
  $("v-err").innerHTML = dup ? `<span class="err">No. pendaftaran ini sudah wujud dalam sistem.</span>` : "";
  $("v-ok").disabled = !valid;
}

async function submitVeh(id){
  const data = {
    plat: $("v-plat").value.trim().toUpperCase(),
    model: $("v-model").value.trim(),
    jenis: $("v-jenis").value,
    kapasiti: parseInt($("v-kapasiti").value) || 1,
    odometer: parseInt($("v-odo").value) || 0,
    bahanApi: Math.min(100, Math.max(0, parseInt($("v-fuel").value) || 0)),
    roadtax: $("v-tax").value,
    status: $("v-status").value,
    lokasi: $("v-lokasi").value.trim() || "Garaj Utama",
  };
  const btn = $("v-ok"); btn.disabled = true;
  const ok = await simpanRekod("vehicleSave", { vehicle: id ? { id, ...data } : data },
    () => { if(id) Object.assign(veh(id), data); else vehicles.push({ id: `K${nextVeh++}`, ...data }); },
    id ? `Kenderaan ${data.plat} dikemas kini.` : `Kenderaan ${data.plat} ditambah ke senarai kenderaan.`);
  if(ok) closeModal(); else btn.disabled = false;
}

function askDelVehicle(id){
  const v = veh(id);
  const aktif = bookings.filter(b => b.vehicleId === id && b.status === "diluluskan");
  if(aktif.length){
    confirmModal("Tidak Boleh Dipadam",
      `Kenderaan <b>${esc(v.plat)}</b> mempunyai ${aktif.length} tempahan aktif yang diluluskan (${aktif.map(a=>a.id).join(", ")}). Sila selesaikan atau tugaskan semula tempahan tersebut dahulu.`,
      null);
    return;
  }
  confirmModal("Arkibkan Kenderaan",
    `Anda pasti mahu mengarkibkan <b>${esc(v.plat)} — ${esc(v.model)}</b>? Ia akan disembunyikan daripada senarai kenderaan, tetapi rekod sejarah & laporan kekal utuh.`,
    () => {
      closeModal();
      // soft-delete — kekalkan rujukan sejarah; server semak semula tempahan aktif
      simpanRekod("vehicleSave", { vehicle: { id, status: "dipadam" } },
        () => { veh(id).status = "dipadam"; }, `Kenderaan ${v.plat} diarkibkan.`);
    }, "🗑 Ya, Arkibkan", "btn-red");
}
