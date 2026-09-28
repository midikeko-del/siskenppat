/* SisKEN — tempahan.js (edit di sini) */
/* ---------- TEMPAHAN ---------- */
function renderTempahan(){
  const semuaSaya = isAdmin() ? bookings : bookings.filter(b => b.userId === currentUser.userId);
  const kiraan = {
    semua: semuaSaya.length,
    menunggu: semuaSaya.filter(b => b.status === "menunggu").length,
    diluluskan: semuaSaya.filter(b => b.status === "diluluskan").length,
    selesai: semuaSaya.filter(b => b.status === "selesai").length,
    ditolak: semuaSaya.filter(b => b.status === "ditolak").length,
  };
  const senarai = terbaruDahulu(semuaSaya.filter(b => tempahanFilter === "semua" || b.status === tempahanFilter));
  const penapis = (key, label) => `<button class="btn ${tempahanFilter===key?'btn-amber':'btn-dark'}" style="padding:6px 12px;font-size:13px" onclick="setTempahanFilter('${key}')">${label}${kiraan[key] ? ` (${kiraan[key]})` : ""}</button>`;

  const cards = senarai.length === 0
    ? `<div class="card" style="padding:36px;text-align:center;color:var(--slate-l)">${semuaSaya.length === 0 ? 'Tiada tempahan lagi. Klik "＋ Tempahan Baharu" untuk memohon kenderaan.' : "Tiada tempahan untuk penapis ini."}</div>`
    : senarai.map(b => {
    const v = veh(b.vehicleId), d = drv(b.driverId);
    return `<div class="bk">
      <div style="flex:1;min-width:260px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="id">${b.id}</span>${chip(BSTATUS[b.status])}
        </div>
        <h4>${esc(b.tujuan)}</h4>
        <div class="meta">📍 ${esc(b.destinasi)} &nbsp;·&nbsp; ${paparTarikh(b)}, ${paparMasa(b)} &nbsp;·&nbsp; ${b.penumpang} penumpang</div>
        <div class="who">Pemohon: ${esc(b.pemohon)} — ${esc(b.bahagian)}</div>
        ${v ? `<div class="assign"><span class="plat">${esc(v.plat)}</span> ${esc(v.model)} &nbsp;|&nbsp; ${esc(d.nama)}</div>` : ""}
        ${b.masaSelesai ? `<div class="who" style="color:var(--green);margin-top:6px">✔ Selesai sebenar: ${fmtMasaSelesai(b.masaSelesai)}</div>` : ""}
      </div>
      ${isAdmin() && (b.status === "menunggu" || b.status === "diluluskan") ? `
      <div style="display:flex;flex-direction:column;gap:8px;align-self:flex-start">
        ${b.status === "menunggu" ? `<button class="btn btn-dark" onclick="openApprove('${b.id}')">Proses ›</button>` : ""}
        <button class="btn btn-edit" onclick="openEditForm('${b.id}')">✎ Edit</button>
      </div>` : ""}
    </div>`;
  }).join("");

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">${isAdmin() ? "Senarai Tempahan" : "Tempahan Saya"}</h2>
      <button class="btn btn-amber" onclick="openForm()">＋ Tempahan Baharu</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
      ${penapis("semua","Semua")}${penapis("menunggu","Menunggu")}${penapis("diluluskan","Diluluskan")}${penapis("selesai","Selesai")}${penapis("ditolak","Ditolak")}
    </div>
    <div style="display:grid;gap:14px">${cards}</div>`;
}

function setTempahanFilter(f){ tempahanFilter = f; render(); }
async function complete(id){
  const b = bookings.find(b => b.id === id);
  /* Mod demo / tiada API */
  if(!apiAktif() || !TOKEN){
    b.status = "selesai"; b.masaSelesai = skrgStr();
    const [tkhS, msS] = b.masaSelesai.split(" ");
    if(!b.masaTamat) b.masaTamat = msS;
    if(tkhS !== b.tarikh) b.tarikhTamat = tkhS;
    render(); notify(`Tempahan ${id} ditanda selesai (mod tempatan).`);
    return;
  }
  /* Guna masa server, bukan masa peranti */
  setSync("saving");
  try{
    const res = await api("bookingComplete", { id });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){ setSync("err"); notify(res.ralat || "Gagal menanda selesai."); return; }
    Object.assign(b, res.booking);
    setSync("ok"); render(); notify(`Tempahan ${id} ditanda selesai pada ${fmtMasaSelesai(b.masaSelesai)}.`);
  }catch(e){ setSync("err"); notify("Gagal menghubungi pelayan."); }
}

/* ---------- Modal: proses kelulusan ---------- */
function openApprove(id){
  const b = bookings.find(x => x.id === id);
  const vehOpts = kenderaanAktif().filter(v => v.status !== "selenggara").map(v =>
    `<option value="${v.id}" ${v.kapasiti < b.penumpang ? "disabled" : ""}>${esc(v.plat)} · ${esc(v.model)} (${v.kapasiti} tempat)${v.kapasiti < b.penumpang ? " — kapasiti tidak mencukupi" : ""}</option>`
  ).join("");
  const drvOpts = pemanduAktif().map(d =>
    `<option value="${d.id}" ${d.status==="cuti" ? "disabled" : ""}>${esc(d.nama)}${d.status==="cuti" ? " — bercuti" : ""}</option>`
  ).join("");

  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-h"><h3>Proses Tempahan ${b.id}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="summary">
          <b>${esc(b.tujuan)}</b><br>
          ${esc(b.destinasi)} · ${paparTarikh(b)}, ${paparMasa(b)} · ${b.penumpang} penumpang<br>
          <span class="muted">${esc(b.pemohon)} — ${esc(b.bahagian)}</span>
        </div>
        <label class="fld"><span>Tugaskan Kenderaan</span>
          <select id="ap-veh" onchange="checkClash('${b.id}')"><option value="">— Pilih kenderaan —</option>${vehOpts}</select>
        </label>
        <label class="fld"><span>Tugaskan Pemandu</span>
          <select id="ap-drv" onchange="checkClash('${b.id}')"><option value="">— Pilih pemandu —</option>${drvOpts}</select>
        </label>
        <div id="ap-clash"></div>
        <div class="btn-row">
          <button class="btn btn-green" id="ap-ok" disabled onclick="doApprove('${b.id}')">✔ Luluskan</button>
          <button class="btn btn-red" onclick="doReject('${b.id}')">✕ Tolak</button>
        </div>
      </div>
    </div>
  </div>`;
}

function checkClash(id){
  const b = bookings.find(x => x.id === id);
  const vId = $("ap-veh").value, dId = $("ap-drv").value;
  const box = $("ap-clash"), ok = $("ap-ok");
  if(!vId || !dId){ box.innerHTML = ""; ok.disabled = true; return; }
  const cl = conflicts(b, vId, dId);
  if(cl.length){
    box.innerHTML = `<div class="clash"><b>⚠️ Konflik jadual dikesan:</b>${cl.map(c =>
      `<p>• ${c.id} — ${esc(c.destinasi)}, ${paparMasa(c)}</p>`).join("")}</div>`;
    ok.disabled = true;
  } else {
    box.innerHTML = "";
    ok.disabled = false;
  }
}

async function doApprove(id){
  const b = bookings.find(x => x.id === id);
  const vId = $("ap-veh").value, dId = $("ap-drv").value;

  /* Mod demo / tiada API */
  if(!apiAktif() || !TOKEN){
    b.status = "diluluskan"; b.vehicleId = vId; b.driverId = dId;
    closeModal(); render(); notify(`Tempahan ${id} diluluskan (mod tempatan).`);
    return;
  }
  /* Server sahkan konflik & kapasiti sebelum lulus */
  const btn = $("ap-ok"); btn.disabled = true; btn.textContent = "Memproses…";
  try{
    const res = await api("bookingApprove", { id, vehicleId: vId, driverId: dId });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("ap-clash").innerHTML = `<div class="clash"><b>⚠️ ${esc(res.ralat || "Gagal meluluskan.")}</b></div>`;
      btn.disabled = false; btn.textContent = "✔ Luluskan"; return;
    }
    Object.assign(b, res.booking);
    closeModal(); render(); notify(`Tempahan ${id} diluluskan.`);
  }catch(e){
    $("ap-clash").innerHTML = `<div class="clash"><b>Gagal menghubungi pelayan.</b></div>`;
    btn.disabled = false; btn.textContent = "✔ Luluskan";
  }
}
async function doReject(id){
  const b = bookings.find(x => x.id === id);
  if(!apiAktif() || !TOKEN){
    b.status = "ditolak"; closeModal(); render(); notify(`Tempahan ${id} ditolak (mod tempatan).`);
    return;
  }
  try{
    const res = await api("bookingReject", { id });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){ notify(res.ralat || "Gagal menolak tempahan."); return; }
    Object.assign(b, res.booking);
    closeModal(); render(); notify(`Tempahan ${id} ditolak.`);
  }catch(e){ notify("Gagal menghubungi pelayan."); }
}

/* ---------- Modal: tempahan baharu ---------- */
function openForm(){
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-h"><h3>Tempahan Baharu</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="row2">
          <label class="fld"><span>Nama Pemohon</span><input id="f-pemohon" value="${currentUser ? esc(currentUser.nama) : ""}" placeholder="cth: Pn. Aishah Kamal" oninput="checkForm()"></label>
          <label class="fld"><span>Bahagian / Unit</span><input id="f-bahagian" placeholder="cth: Bahagian Kewangan" oninput="checkForm()"></label>
        </div>
        <label class="fld"><span>Tujuan Perjalanan</span><input id="f-tujuan" placeholder="cth: Mesyuarat penyelarasan" oninput="checkForm()"></label>
        <label class="fld"><span>Destinasi</span><input id="f-destinasi" placeholder="cth: Putrajaya, Presint 4" oninput="checkForm()"></label>
        <div class="row2">
          <label class="fld"><span>Tarikh Mula</span><input type="date" id="f-tarikh" value="${HARI_INI}" min="${HARI_INI}" oninput="checkForm()"></label>
          <label class="fld"><span>Tarikh Tamat <span style="text-transform:none;font-weight:400">(pilihan — untuk tempahan lebih sehari)</span></span><input type="date" id="f-tkh2" min="${HARI_INI}" oninput="checkForm()"></label>
        </div>
        <div class="row4">
          <label class="fld"><span>Masa Mula</span><input type="time" id="f-mula" value="09:00" oninput="checkForm()"></label>
          <label class="fld"><span>Masa Tamat <span style="text-transform:none;font-weight:400">(pilihan)</span></span><input type="time" id="f-tamat" oninput="checkForm()"></label>
          <label class="fld"><span>Penumpang</span><input type="number" id="f-pax" value="1" min="1" max="11" oninput="checkForm()"></label>
        </div>
        <div id="f-err"></div>
        <button class="btn btn-amber" id="f-ok" style="justify-content:center" onclick="submitForm()">Hantar Tempahan</button>
      </div>
    </div>
  </div>`;
  checkForm();
}

function checkForm(){
  const mula = $("f-mula").value, tamat = $("f-tamat").value;
  const tkh = $("f-tarikh").value, tkh2 = $("f-tkh2").value;
  const sehari = !tkh2 || tkh2 === tkh;                 // tempahan hari yang sama
  const tarikhOK = !tkh2 || tkh2 >= tkh;                // tarikh tamat tidak boleh sebelum tarikh mula
  const k = klNow();                                    // tarikh + masa KL semasa
  const tidakLampau = !tkh || tkh > k.tarikh || (tkh === k.tarikh && (!mula || mula >= k.masa)); // tiada masa lampau
  const masaOK = !sehari || !tamat || mula < tamat;     // peraturan masa hanya untuk hari sama
  const valid = $("f-pemohon").value.trim() && $("f-bahagian").value.trim() &&
                $("f-tujuan").value.trim() && $("f-destinasi").value.trim() &&
                tkh && mula && tarikhOK && masaOK && tidakLampau;
  let mesej = `<span class="muted">Masa tamat boleh dibiarkan kosong — ia direkodkan automatik apabila pemandu menanda Selesai. Untuk tempahan bermalam / lebih sehari, isi Tarikh Tamat.</span>`;
  if(!tidakLampau) mesej = `<span class="err">Tarikh/masa tempahan tidak boleh pada masa lampau.</span>`;
  else if(!tarikhOK) mesej = `<span class="err">Tarikh tamat mesti pada atau selepas tarikh mula.</span>`;
  else if(sehari && tamat && mula >= tamat) mesej = `<span class="err">Masa tamat mesti selepas masa mula.</span>`;
  $("f-err").innerHTML = mesej;
  $("f-ok").disabled = !valid;
}

async function submitForm(){
  const booking = {
    pemohon: $("f-pemohon").value.trim(),
    bahagian: $("f-bahagian").value.trim(),
    tujuan: $("f-tujuan").value.trim(),
    destinasi: $("f-destinasi").value.trim(),
    tarikh: $("f-tarikh").value,
    tarikhTamat: $("f-tkh2").value || "",
    masaMula: $("f-mula").value,
    masaTamat: $("f-tamat").value,
    penumpang: parseInt($("f-pax").value) || 1,
  };

  /* Mod demo / tiada API: simpan setempat sahaja (tidak kekal) */
  if(!apiAktif() || !TOKEN){
    const id = `T-${nextNum++}`;
    bookings.unshift({ id, status:"menunggu", vehicleId:null, driverId:null,
      userId: currentUser ? currentUser.userId : null, masaSelesai:"", ...booking });
    closeModal(); render(); notify(`Tempahan ${id} dihantar (mod tempatan).`);
    return;
  }

  /* Server jana ID & tetapkan status — pemohon tidak boleh lulus sendiri */
  const btn = $("f-ok"); btn.disabled = true; btn.textContent = "Menghantar…";
  try{
    const res = await api("bookingAdd", { booking });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("f-err").innerHTML = `<span class="err">${esc(res.ralat || "Gagal menghantar tempahan.")}</span>`;
      btn.disabled = false; btn.textContent = "Hantar Tempahan"; return;
    }
    bookings.unshift(res.booking);
    closeModal(); render(); notify(`Tempahan ${res.booking.id} dihantar untuk kelulusan.`);
  }catch(e){
    $("f-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "Hantar Tempahan";
  }
}

/* ---------- Modal: edit tempahan (admin sahaja) ----------
 * Hanya boleh diedit SELAGI tempahan belum bermula. SOP sama dengan
 * permohonan baharu — tiada pertindihan jadual dibenarkan. */
function openEditForm(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  /* Tempahan sudah bermula → tiada perubahan dibenarkan */
  if(mulaDT(b) <= skrgStr()){
    notify("Tempahan sedang berjalan. Tiada perubahan dibenarkan.", "warn");
    return;
  }
  const v = veh(b.vehicleId), d = drv(b.driverId);
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-h"><h3>Edit Tempahan ${b.id}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        ${b.status === "diluluskan" && v ? `<div class="summary" style="margin-bottom:14px">Tugasan semasa: <b>${esc(v.plat)}</b> ${esc(v.model)}${d ? " — " + esc(d.nama) : ""}<br><span class="muted">Perubahan tarikh/masa mesti tiada pertindihan dengan tugasan kenderaan/pemandu ini.</span></div>` : ""}
        <div class="row2">
          <label class="fld"><span>Nama Pemohon</span><input id="e-pemohon" value="${esc(b.pemohon)}" oninput="checkEditForm('${b.id}')"></label>
          <label class="fld"><span>Bahagian / Unit</span><input id="e-bahagian" value="${esc(b.bahagian)}" oninput="checkEditForm('${b.id}')"></label>
        </div>
        <label class="fld"><span>Tujuan Perjalanan</span><input id="e-tujuan" value="${esc(b.tujuan)}" oninput="checkEditForm('${b.id}')"></label>
        <label class="fld"><span>Destinasi</span><input id="e-destinasi" value="${esc(b.destinasi)}" oninput="checkEditForm('${b.id}')"></label>
        <div class="row2">
          <label class="fld"><span>Tarikh Mula</span><input type="date" id="e-tarikh" value="${b.tarikh}" min="${HARI_INI}" oninput="checkEditForm('${b.id}')"></label>
          <label class="fld"><span>Tarikh Tamat <span style="text-transform:none;font-weight:400">(pilihan)</span></span><input type="date" id="e-tkh2" value="${b.tarikhTamat || ""}" min="${HARI_INI}" oninput="checkEditForm('${b.id}')"></label>
        </div>
        <div class="row4">
          <label class="fld"><span>Masa Mula</span><input type="time" id="e-mula" value="${b.masaMula}" oninput="checkEditForm('${b.id}')"></label>
          <label class="fld"><span>Masa Tamat <span style="text-transform:none;font-weight:400">(pilihan)</span></span><input type="time" id="e-tamat" value="${b.masaTamat || ""}" oninput="checkEditForm('${b.id}')"></label>
          <label class="fld"><span>Penumpang</span><input type="number" id="e-pax" value="${b.penumpang}" min="1" max="44" oninput="checkEditForm('${b.id}')"></label>
        </div>
        <div id="e-clash"></div>
        <div id="e-err"></div>
        <button class="btn btn-amber" id="e-ok" style="justify-content:center" onclick="submitEdit('${b.id}')">Simpan Perubahan</button>
      </div>
    </div>
  </div>`;
  checkEditForm(id);
}

function checkEditForm(id){
  const b = bookings.find(x => x.id === id);
  const mula = $("e-mula").value, tamat = $("e-tamat").value;
  const tkh = $("e-tarikh").value, tkh2 = $("e-tkh2").value;
  const sehari = !tkh2 || tkh2 === tkh;
  const tarikhOK = !tkh2 || tkh2 >= tkh;
  const k = klNow();
  const tidakLampau = !tkh || tkh > k.tarikh || (tkh === k.tarikh && (!mula || mula >= k.masa));
  const masaOK = !sehari || !tamat || mula < tamat;
  const isiOK = $("e-pemohon").value.trim() && $("e-bahagian").value.trim() &&
                $("e-tujuan").value.trim() && $("e-destinasi").value.trim() && tkh && mula;

  /* Semakan pertindihan (hanya bermakna jika kenderaan/pemandu sudah ditugaskan) */
  let konflik = [];
  if(b && (b.vehicleId || b.driverId)){
    const calon = { id: b.id, tarikh: tkh, tarikhTamat: tkh2 || "", masaMula: mula, masaTamat: tamat };
    konflik = conflicts(calon, b.vehicleId, b.driverId);
  }
  $("e-clash").innerHTML = konflik.length
    ? `<div class="clash"><b>⚠️ Konflik jadual dikesan:</b>${konflik.map(c =>
        `<p>• ${c.id} — ${esc(c.destinasi)}, ${fmtTarikh(c.tarikh)} ${paparMasa(c)}</p>`).join("")}</div>`
    : "";

  let mesej = "";
  if(!tidakLampau) mesej = `<span class="err">Tarikh/masa tempahan tidak boleh pada masa lampau.</span>`;
  else if(!tarikhOK) mesej = `<span class="err">Tarikh tamat mesti pada atau selepas tarikh mula.</span>`;
  else if(sehari && tamat && mula >= tamat) mesej = `<span class="err">Masa tamat mesti selepas masa mula.</span>`;
  $("e-err").innerHTML = mesej;

  $("e-ok").disabled = !(isiOK && tarikhOK && masaOK && tidakLampau && konflik.length === 0);
}

async function submitEdit(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  /* Semak semula pada saat hantar — mungkin sudah bermula sejak modal dibuka */
  if(mulaDT(b) <= skrgStr()){
    closeModal();
    notify("Tempahan sedang berjalan. Tiada perubahan dibenarkan.", "warn");
    render();
    return;
  }
  const patch = {
    pemohon: $("e-pemohon").value.trim(),
    bahagian: $("e-bahagian").value.trim(),
    tujuan: $("e-tujuan").value.trim(),
    destinasi: $("e-destinasi").value.trim(),
    tarikh: $("e-tarikh").value,
    tarikhTamat: $("e-tkh2").value || "",
    masaMula: $("e-mula").value,
    masaTamat: $("e-tamat").value,
    penumpang: parseInt($("e-pax").value) || 1,
  };

  /* Mod demo / tiada API: simpan setempat sahaja */
  if(!apiAktif() || !TOKEN){
    Object.assign(b, patch);
    closeModal(); render(); notify(`Tempahan ${id} dikemas kini (mod tempatan).`);
    return;
  }

  /* Server sahkan semula peraturan masa & konflik sebelum simpan */
  const btn = $("e-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";
  try{
    const res = await api("bookingEdit", { id, ...patch });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("e-err").innerHTML = `<span class="err">${esc(res.ralat || "Gagal mengemas kini tempahan.")}</span>`;
      btn.disabled = false; btn.textContent = "Simpan Perubahan"; return;
    }
    Object.assign(b, res.booking);
    closeModal(); render(); notify(`Tempahan ${id} dikemas kini.`);
  }catch(e){
    $("e-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "Simpan Perubahan";
  }
}
