/* SisKEN — selenggara.js (edit di sini) */
/* ============================================================
   MODUL SELENGGARAAN
   ============================================================ */
function renderSelenggara(){
  const list = maintenance
    .filter(s => selFilter === "semua" || s.vehicleId === selFilter)
    .sort((a,b) => b.tarikh.localeCompare(a.tarikh));

  const opts = vehicles.map(v =>
    `<option value="${v.id}" ${selFilter===v.id?"selected":""}>${esc(v.plat)} — ${esc(v.model)}</option>`).join("");

  const jumlahKos = list.filter(s => s.status !== "dijadual").reduce((t,s) => t + s.kos, 0);

  const rows = list.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--slate-l)">Tiada rekod selenggaraan.</td></tr>`
    : list.map(s => {
        const v = veh(s.vehicleId);
        return `<tr>
          <td style="white-space:nowrap">${fmtTarikh(s.tarikh)}</td>
          <td>${v ? `<span class="plat">${esc(v.plat)}</span><div class="muted" style="margin-top:4px">${esc(v.model)}</div>` : '<span class="muted">Kenderaan dipadam</span>'}</td>
          <td><b>${esc(s.jenis)}</b><div class="muted" style="margin-top:2px">${esc(s.butiran)}</div></td>
          <td style="color:var(--slate)">${esc(s.bengkel)}</td>
          <td class="kos">${s.kos > 0 ? rm(s.kos) : '<span class="muted">—</span>'}</td>
          <td>${chip(SSTATUS[s.status])}</td>
          <td style="white-space:nowrap">
            <button class="btn-edit" onclick="openSelForm('${s.id}')">✎</button>
            <button class="btn-del" onclick="askDelSel('${s.id}')">🗑</button>
          </td>
        </tr>`;
      }).join("");

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Rekod Sejarah Selenggaraan</h2>
      <button class="btn btn-amber" onclick="openSelForm()">＋ Tambah Rekod</button>
    </div>
    <div class="card">
      <div class="card-h">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--slate)">Tapis kenderaan:</span>
          <select style="width:auto;min-width:220px" onchange="selFilter=this.value;render()">
            <option value="semua" ${selFilter==="semua"?"selected":""}>Semua kenderaan</option>
            ${opts}
          </select>
        </div>
        <span class="muted">Jumlah kos rekod dipapar: <b style="color:var(--ink)">${rm(jumlahKos)}</b></span>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Tarikh</th><th>Kenderaan</th><th>Jenis & Butiran Kerja</th><th>Bengkel / Pembekal</th><th style="text-align:right">Kos</th><th>Status</th><th>Tindakan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

function openSelForm(id){
  const s = id ? maintenance.find(x => x.id === id) : null;
  const vOpts = kenderaanAktif().map(v =>
    `<option value="${v.id}" ${s&&s.vehicleId===v.id?"selected":""}>${esc(v.plat)} — ${esc(v.model)}</option>`).join("");
  const jOpts = JENIS_SEL.map(j => `<option ${s&&s.jenis===j?"selected":""}>${j}</option>`).join("");

  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-h"><h3>${s ? "Edit Rekod Selenggaraan" : "Tambah Rekod Selenggaraan"}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <label class="fld"><span>Kenderaan</span><select id="s-veh">${vOpts}</select></label>
        <div class="row2">
          <label class="fld"><span>Tarikh</span><input type="date" id="s-tarikh" value="${s?s.tarikh:HARI_INI}" oninput="checkSelForm()"></label>
          <label class="fld"><span>Jenis Kerja</span><select id="s-jenis">${jOpts}</select></label>
        </div>
        <label class="fld"><span>Butiran Kerja</span><input id="s-butiran" value="${s?esc(s.butiran):""}" placeholder="cth: Servis 50,000 km — tukar minyak enjin & penapis" oninput="checkSelForm()"></label>
        <label class="fld"><span>Bengkel / Pembekal</span><input id="s-bengkel" value="${s?esc(s.bengkel):""}" placeholder="cth: Pusat Servis Toyota, Cheras" oninput="checkSelForm()"></label>
        <div class="row2">
          <label class="fld"><span>Kos (RM)</span><input type="number" id="s-kos" value="${s?s.kos:0}" min="0" step="0.01"></label>
          <label class="fld"><span>Odometer (km)</span><input type="number" id="s-odo" value="${s?s.odometer:""}" min="0"></label>
        </div>
        <label class="fld"><span>Status</span>
          <select id="s-status">
            <option value="dijadual" ${s&&s.status==="dijadual"?"selected":""}>Dijadualkan</option>
            <option value="dalam_proses" ${s&&s.status==="dalam_proses"?"selected":""}>Dalam Proses</option>
            <option value="selesai" ${!s||s.status==="selesai"?"selected":""}>Selesai</option>
          </select>
        </label>
        <button class="btn btn-amber" id="s-ok" style="justify-content:center" onclick="submitSel(${s?`'${s.id}'`:"null"})">
          ${s ? "Simpan Perubahan" : "Tambah Rekod"}
        </button>
      </div>
    </div>
  </div>`;
  checkSelForm();
}

function checkSelForm(){
  $("s-ok").disabled = !($("s-tarikh").value && $("s-butiran").value.trim() && $("s-bengkel").value.trim());
}

function submitSel(id){
  const data = {
    vehicleId: $("s-veh").value,
    tarikh: $("s-tarikh").value,
    jenis: $("s-jenis").value,
    butiran: $("s-butiran").value.trim(),
    bengkel: $("s-bengkel").value.trim(),
    kos: parseFloat($("s-kos").value) || 0,
    odometer: parseInt($("s-odo").value) || 0,
    status: $("s-status").value,
  };
  if(id){
    Object.assign(maintenance.find(x => x.id === id), data);
    notify("Rekod selenggaraan dikemas kini.");
  } else {
    maintenance.push({ id:`S${nextSel++}`, ...data });
    notify("Rekod selenggaraan ditambah.");
  }
  closeModal(); sync();
}

function askDelSel(id){
  const s = maintenance.find(x => x.id === id);
  const v = veh(s.vehicleId);
  confirmModal("Padam Rekod Selenggaraan",
    `Anda pasti mahu memadam rekod <b>${esc(s.jenis)}</b> (${fmtTarikh(s.tarikh)})${v ? ` bagi <b>${esc(v.plat)}</b>` : ""}? Tindakan ini tidak boleh dibatalkan.`,
    () => {
      maintenance = maintenance.filter(x => x.id !== id);
      closeModal(); sync(); notify("Rekod selenggaraan dipadam.");
    });
}
