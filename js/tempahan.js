/* SisKEN — tempahan.js (edit di sini) */
/* ---------- TEMPAHAN ---------- */
function kadTempahan(b){
  const v = veh(b.vehicleId), d = drv(b.driverId);
  return `<div class="bk">
      <div style="flex:1;min-width:260px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="id">${b.id}</span>${chip(BSTATUS[b.status])}
        </div>
        <h4>${esc(b.tujuan)}</h4>
        <div class="meta">📍 ${esc(b.destinasi)} &nbsp;·&nbsp; ${paparTarikh(b)}, ${paparMasa(b)} &nbsp;·&nbsp; ${b.penumpang} penumpang</div>
        <div class="who">Pemohon: ${esc(b.pemohon)} — ${esc(b.bahagian)}${b.telefonPemohon ? ` &nbsp;·&nbsp; ${telPaut(b.telefonPemohon)}` : ""}</div>
        ${v ? `<div class="assign"><span class="plat">${esc(v.plat)}</span> ${esc(v.model)}${d ? ` &nbsp;|&nbsp; ${esc(d.nama)}${d.telefon ? ` &nbsp;·&nbsp; ${telPaut(d.telefon)}` : ""}` : ""}</div>` : ""}
        ${b.status === "diluluskan" && b.driverId ? (b.diterima
          ? `<div class="who" style="color:var(--green);margin-top:4px">✔ Pemandu telah terima tugasan (${fmtMasaSelesai(b.diterima)})</div>`
          : (mulaDT(b) <= skrgStr()
            ? `<div class="who" style="color:var(--red);font-weight:600;margin-top:4px">⚠️ Pemandu belum terima tugasan walaupun masa perjalanan telah tiba — sila hubungi pemandu atau tarik balik tugasan.</div>`
            : `<div class="who" style="color:var(--amber-d);margin-top:4px">⏳ Menunggu pemandu terima tugasan</div>`)) : ""}
        ${b.masaSelesai ? `<div class="who" style="color:var(--green);margin-top:6px">✔ Selesai sebenar: ${fmtMasaSelesai(b.masaSelesai)}</div>` : ""}
        ${b.status === "ditolak" && b.sebabTolak ? `<div class="who" style="color:var(--red);margin-top:6px">✕ Sebab ditolak: ${esc(b.sebabTolak)}</div>` : ""}
      </div>
      ${!isAdmin() && b.status === "menunggu" && currentUser && b.userId === currentUser.userId ? `
      <div style="display:flex;flex-direction:column;gap:8px;align-self:flex-start">
        <button class="btn btn-edit" onclick="openEditForm('${b.id}')">✎ Edit</button>
        <button class="btn btn-red" onclick="askBatalTempahan('${b.id}')">✕ Batal</button>
      </div>` : ""}
      ${isAdmin() && (b.status === "menunggu" || b.status === "diluluskan") ? `
      <div style="display:flex;flex-direction:column;gap:8px;align-self:flex-start">
        ${b.status === "menunggu" ? `<button class="btn btn-dark" onclick="openApprove('${b.id}')">Proses ›</button>` : ""}
        <button class="btn btn-edit" onclick="openEditForm('${b.id}')">✎ Edit</button>
        ${b.status === "diluluskan" && mulaDT(b) > skrgStr() ? `<button class="btn btn-dark" onclick="openTukarTugasan('${b.id}')">🔄 Tukar Tugasan</button>` : ""}
        ${b.status === "diluluskan" && !b.diterima ? `<button class="btn btn-red" onclick="askTarikBalik('${b.id}')">↩ Tarik Balik</button>` : ""}
      </div>` : ""}
    </div>`;
}

function tempahanTersenarai(semuaSaya){
  const q = (tempahanCari || "").trim().toLowerCase();
  return terbaruDahulu(semuaSaya.filter(b => {
    if(tempahanFilter !== "semua" && b.status !== tempahanFilter) return false;
    if(!q) return true;
    return [b.id, b.pemohon, b.bahagian, b.tujuan, b.destinasi].some(x => String(x || "").toLowerCase().includes(q));
  }));
}

function tempahanSenaraiHTML(semuaSaya){
  const senarai = tempahanTersenarai(semuaSaya);
  if(senarai.length === 0){
    return `<div class="card" style="padding:36px;text-align:center;color:var(--slate-l)">${semuaSaya.length === 0 && !tempahanDari && !tempahanHingga ? 'Tiada tempahan lagi. Klik "＋ Tempahan Baharu" untuk memohon kenderaan.' : "Tiada tempahan sepadan."}</div>`;
  }
  // Hadkan muka surat SEBELUM potong senarai (senarai boleh mengecil selepas lulus/tolak/selesai)
  tempahanPage = Math.min(Math.max(1, tempahanPage), Math.ceil(senarai.length / SAIZ_HALAMAN));
  const mula = (tempahanPage - 1) * SAIZ_HALAMAN;
  const papar = senarai.slice(mula, mula + SAIZ_HALAMAN);
  return `<div style="display:grid;gap:14px">${papar.map(kadTempahan).join("")}</div>`;
}

function tempahanPagerHTML(semuaSaya){
  const senarai = tempahanTersenarai(semuaSaya);
  const jumHalaman = Math.max(1, Math.ceil(senarai.length / SAIZ_HALAMAN));
  if(jumHalaman <= 1) return "";
  if(tempahanPage > jumHalaman) tempahanPage = jumHalaman;
  const mula = (tempahanPage - 1) * SAIZ_HALAMAN + 1;
  const akhir = Math.min(tempahanPage * SAIZ_HALAMAN, senarai.length);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:6px">
      <span class="muted" style="font-size:13px">Memaparkan ${mula}–${akhir} daripada ${senarai.length}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-dark" style="padding:6px 12px;font-size:13px" ${tempahanPage<=1?"disabled":""} onclick="gerakTempahanPage(-1)">‹ Sebelum</button>
        <span class="muted" style="font-size:13px">Muka ${tempahanPage} / ${jumHalaman}</span>
        <button class="btn btn-dark" style="padding:6px 12px;font-size:13px" ${tempahanPage>=jumHalaman?"disabled":""} onclick="gerakTempahanPage(1)">Seterus ›</button>
      </div>
    </div>`;
}

function renderTempahan(){
  const semuaSaya = (isAdmin() ? bookings : bookings.filter(b => b.userId === currentUser.userId))
    .filter(b => dalamJulat(b, tempahanDari, tempahanHingga));
  const kiraan = {
    semua: semuaSaya.length,
    menunggu: semuaSaya.filter(b => b.status === "menunggu").length,
    diluluskan: semuaSaya.filter(b => b.status === "diluluskan").length,
    selesai: semuaSaya.filter(b => b.status === "selesai").length,
    ditolak: semuaSaya.filter(b => b.status === "ditolak").length,
    dibatalkan: semuaSaya.filter(b => b.status === "dibatalkan").length,
  };
  const penapis = (key, label) => `<button class="btn ${tempahanFilter===key?'btn-amber':'btn-dark'}" style="padding:6px 12px;font-size:13px" onclick="setTempahanFilter('${key}')">${label}${kiraan[key] ? ` (${kiraan[key]})` : ""}</button>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">${isAdmin() ? "Senarai Tempahan" : "Tempahan Saya"}</h2>
      <button class="btn btn-amber" onclick="openForm()">＋ Tempahan Baharu</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:4px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${penapis("semua","Semua")}${penapis("menunggu","Menunggu")}${penapis("diluluskan","Diluluskan")}${penapis("selesai","Selesai")}${penapis("ditolak","Ditolak")}${penapis("dibatalkan","Dibatalkan")}
      </div>
      <input id="tp-cari" type="text" value="${esc(tempahanCari)}" placeholder="🔍 Cari ID, pemohon, destinasi, tujuan…" style="width:auto;min-width:240px" oninput="onTempahanCari(this.value)">
    </div>
    ${julatTarikhHTML("tempahan", tempahanDari, tempahanHingga)}
    <div id="tp-cards">${tempahanSenaraiHTML(semuaSaya)}</div>
    <div id="tp-pager">${tempahanPagerHTML(semuaSaya)}</div>`;
}

function segarTempahanSenarai(){
  const semuaSaya = (isAdmin() ? bookings : bookings.filter(b => b.userId === currentUser.userId))
    .filter(b => dalamJulat(b, tempahanDari, tempahanHingga));
  $("tp-cards").innerHTML = tempahanSenaraiHTML(semuaSaya);
  $("tp-pager").innerHTML = tempahanPagerHTML(semuaSaya);
}

function onTempahanCari(v){ tempahanCari = v; tempahanPage = 1; segarTempahanSenarai(); }
function gerakTempahanPage(d){ tempahanPage += d; segarTempahanSenarai(); }
function setTempahanFilter(f){ tempahanFilter = f; tempahanPage = 1; render(); }
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
  <div class="overlay">
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
          <button class="btn btn-red" onclick="openTolak('${b.id}')">✕ Tolak</button>
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
/* ---------- Admin: tolak tempahan — sebab wajib, dipaparkan kepada pemohon ---------- */
function openTolak(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  $("modal-root").innerHTML = `
  <div class="overlay">
    <div class="modal" style="max-width:480px">
      <div class="modal-h"><h3>Tolak Tempahan ${b.id}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="summary">
          <b>${esc(b.tujuan)}</b><br>
          ${esc(b.destinasi)} · ${paparTarikh(b)}, ${paparMasa(b)}<br>
          <span class="muted">${esc(b.pemohon)} — ${esc(b.bahagian)}</span>
        </div>
        <label class="fld"><span>Sebab Ditolak</span>
          <input id="tl-sebab" maxlength="200" placeholder="cth: Tiada kenderaan tersedia pada tarikh tersebut" oninput="$('tl-ok').disabled = !this.value.trim()" onkeydown="if(event.key==='Enter' && this.value.trim())doReject('${b.id}')">
        </label>
        <p class="muted" style="font-size:12px;margin:-6px 0 12px">Pemohon akan melihat sebab ini pada tempahannya.</p>
        <div id="tl-err"></div>
        <div class="btn-row">
          <button class="btn btn-red" id="tl-ok" disabled onclick="doReject('${b.id}')">✕ Tolak Tempahan</button>
          <button class="btn btn-dark" onclick="openApprove('${b.id}')">‹ Kembali</button>
        </div>
      </div>
    </div>
  </div>`;
  setTimeout(() => { const el = $("tl-sebab"); if(el) el.focus(); }, 50);
}

async function doReject(id){
  const b = bookings.find(x => x.id === id);
  const sebab = $("tl-sebab").value.trim();
  if(!sebab) return;
  if(!apiAktif() || !TOKEN){
    b.status = "ditolak"; b.sebabTolak = sebab; closeModal(); render(); notify(`Tempahan ${id} ditolak (mod tempatan).`);
    return;
  }
  const btn = $("tl-ok"); btn.disabled = true;
  try{
    const res = await api("bookingReject", { id, sebab });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("tl-err").innerHTML = `<span class="err">${esc(res.ralat || "Gagal menolak tempahan.")}</span>`;
      btn.disabled = false; return;
    }
    Object.assign(b, res.booking);
    closeModal(); render(); notify(`Tempahan ${id} ditolak.`);
  }catch(e){
    $("tl-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false;
  }
}

/* ---------- Pemohon: batalkan tempahan sendiri (sebelum diluluskan) ---------- */
function askBatalTempahan(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  confirmModal("Batalkan Tempahan",
    `Batalkan tempahan <b>${esc(b.id)}</b> — ${esc(b.tujuan)} (${paparTarikh(b)})?
     <br><br>Tindakan ini tidak boleh diundur. Jika masih perlukan kenderaan, anda perlu menghantar tempahan baharu.`,
    async () => {
      closeModal();
      if(!apiAktif() || !TOKEN){
        b.status = "dibatalkan"; render(); notify(`Tempahan ${id} dibatalkan (mod tempatan).`);
        return;
      }
      setSync("saving");
      try{
        const res = await api("bookingCancel", { id });
        if(res.sesiTamat){ sesiTamat(); return; }
        if(!res.ok){ setSync("ok"); await segarData(); render(); notify(res.ralat || "Gagal membatalkan tempahan.", "err"); return; }
        Object.assign(b, res.booking);
        jejakTempahan = ambilJejak();
        setSync("ok"); render(); notify(`Tempahan ${id} dibatalkan.`);
      }catch(e){ setSync("err"); render(); notify("Gagal menghubungi pelayan.", "err"); }
    }, "✕ Ya, Batalkan", "btn-red");
}

/* ---------- Admin: tukar kenderaan / pemandu (sebelum perjalanan bermula) ---------- */
function openTukarTugasan(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  if(mulaDT(b) <= skrgStr()){
    notify("Perjalanan telah bermula. Tiada pertukaran dibenarkan.", "warn");
    return;
  }
  /* Kenderaan/pemandu semasa sentiasa boleh dipilih walaupun kini dalam selenggaraan
     atau bercuti — ia sudah ditugaskan; admin perlu melihat keadaan sebenar. */
  const vehOpts = kenderaanAktif()
    .filter(v => v.status !== "selenggara" || v.id === b.vehicleId)
    .map(v => `<option value="${v.id}" ${v.id===b.vehicleId?"selected":""} ${v.kapasiti < b.penumpang ? "disabled" : ""}>${esc(v.plat)} · ${esc(v.model)} (${v.kapasiti} tempat)${v.kapasiti < b.penumpang ? " — kapasiti tidak mencukupi" : ""}${v.status==="selenggara" ? " — dalam selenggaraan" : ""}</option>`).join("");
  const drvOpts = pemanduAktif()
    .map(d => `<option value="${d.id}" ${d.id===b.driverId?"selected":""} ${d.status==="cuti" && d.id!==b.driverId ? "disabled" : ""}>${esc(d.nama)}${d.status==="cuti" ? " — bercuti" : ""}</option>`).join("");

  $("modal-root").innerHTML = `
  <div class="overlay">
    <div class="modal">
      <div class="modal-h"><h3>Tukar Tugasan ${b.id}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="summary">
          <b>${esc(b.tujuan)}</b><br>
          ${esc(b.destinasi)} · ${paparTarikh(b)}, ${paparMasa(b)} · ${b.penumpang} penumpang
        </div>
        <p class="muted" style="font-size:13px;line-height:1.6">Pertukaran akan <b>membatalkan pengesahan pemandu</b> — pemandu yang ditugaskan perlu menekan "Terima Tugas" semula untuk mengesahkan kenderaan dan tugasan terkini.</p>
        <label class="fld"><span>Kenderaan</span>
          <select id="tt-veh" onchange="checkTukarTugasan('${b.id}')">${vehOpts}</select>
        </label>
        <label class="fld"><span>Pemandu</span>
          <select id="tt-drv" onchange="checkTukarTugasan('${b.id}')">${drvOpts}</select>
        </label>
        <div id="tt-clash"></div>
        <button class="btn btn-amber" id="tt-ok" style="justify-content:center" onclick="hantarTukarTugasan('${b.id}')">🔄 Simpan Pertukaran</button>
      </div>
    </div>
  </div>`;
  checkTukarTugasan(id);
}

function checkTukarTugasan(id){
  const b = bookings.find(x => x.id === id);
  const vId = $("tt-veh").value, dId = $("tt-drv").value;
  const box = $("tt-clash"), ok = $("tt-ok");
  const samaSaja = vId === b.vehicleId && dId === b.driverId;
  const cl = (vId && dId) ? conflicts(b, vId, dId) : [];
  if(samaSaja){
    box.innerHTML = `<div class="muted" style="font-size:13px;margin-bottom:10px">Tiada perubahan — pilih kenderaan atau pemandu yang berbeza.</div>`;
    ok.disabled = true; return;
  }
  if(cl.length){
    box.innerHTML = `<div class="clash"><b>⚠️ Konflik jadual dikesan:</b>${cl.map(c =>
      `<p>• ${c.id} — ${esc(c.destinasi)}, ${paparMasa(c)}</p>`).join("")}</div>`;
    ok.disabled = true; return;
  }
  box.innerHTML = "";
  ok.disabled = !(vId && dId);
}

async function hantarTukarTugasan(id){
  const b = bookings.find(x => x.id === id);
  const vId = $("tt-veh").value, dId = $("tt-drv").value;
  const btn = $("tt-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";

  if(!apiAktif() || !TOKEN){
    b.vehicleId = vId; b.driverId = dId; b.diterima = "";
    closeModal(); render(); notify(`Tugasan ${id} ditukar (mod tempatan).`);
    return;
  }
  setSync("saving");
  try{
    const res = await api("bookingReassign", { id, vehicleId: vId, driverId: dId });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("tt-clash").innerHTML = `<div class="clash"><b>⚠️ ${esc(res.ralat || "Gagal menukar tugasan.")}</b></div>`;
      btn.disabled = false; btn.textContent = "🔄 Simpan Pertukaran"; setSync("err"); return;
    }
    if(res.data) pakaiData(res.data); else Object.assign(b, res.booking);
    setSync("ok"); closeModal(); render();
    notify(`Tugasan ${id} ditukar. Pemandu perlu menerima semula tugasan ini.`);
  }catch(e){
    $("tt-clash").innerHTML = `<div class="clash"><b>Gagal menghubungi pelayan.</b></div>`;
    btn.disabled = false; btn.textContent = "🔄 Simpan Pertukaran"; setSync("err");
  }
}

/* ---------- Admin: tarik balik tugasan yang belum disahkan pemandu ---------- */
function askTarikBalik(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  const v = veh(b.vehicleId), d = drv(b.driverId);
  confirmModal("Tarik Balik Tugasan",
    `Tarik balik tugasan <b>${esc(b.id)}</b>${v ? ` daripada <b>${esc(v.plat)}</b>` : ""}${d ? ` dan <b>${esc(d.nama)}</b>` : ""}?
     <br><br>Tempahan akan kembali ke <b>Menunggu Kelulusan</b> supaya anda boleh menugaskan kenderaan/pemandu lain.
     Hanya boleh dilakukan selagi pemandu belum mengesahkan tugasan.`,
    async () => {
      closeModal();
      if(!apiAktif() || !TOKEN){
        b.status = "menunggu"; b.vehicleId = null; b.driverId = null; b.diterima = "";
        render(); notify(`Tugasan ${id} ditarik balik (mod tempatan).`);
        return;
      }
      setSync("saving");
      try{
        const res = await api("bookingUnassign", { id });
        if(res.sesiTamat){ sesiTamat(); return; }
        if(!res.ok){ setSync("err"); render(); notify(res.ralat || "Gagal menarik balik tugasan.", "err"); return; }
        if(res.data) pakaiData(res.data); else Object.assign(b, res.booking);
        setSync("ok"); render();
        notify(`Tugasan ${id} ditarik balik. Tempahan kembali ke Menunggu Kelulusan.`);
      }catch(e){ setSync("err"); render(); notify("Gagal menghubungi pelayan.", "err"); }
    }, "↩ Ya, Tarik Balik", "btn-red");
}

/* ---------- Modal: tempahan baharu ---------- */
function openForm(){
  $("modal-root").innerHTML = `
  <div class="overlay">
    <div class="modal">
      <div class="modal-h"><h3>Tempahan Baharu</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="row2">
          <label class="fld"><span>Nama Pemohon</span><input id="f-pemohon" maxlength="150" value="${currentUser ? esc(currentUser.nama) : ""}" placeholder="cth: Pn. Aishah Kamal" oninput="checkForm()"></label>
          <label class="fld"><span>Bahagian / Unit</span><input id="f-bahagian" maxlength="150" placeholder="cth: Bahagian Kewangan" oninput="checkForm()"></label>
        </div>
        <label class="fld"><span>No. Telefon Untuk Dihubungi</span><input id="f-tel" type="tel" maxlength="30" placeholder="cth: 012-345 6789" oninput="checkForm()"></label>
        <p class="muted" style="font-size:12px;margin:-6px 0 12px">Pemandu yang ditugaskan akan melihat nombor ini untuk menyelaras tempat dan masa berjumpa.</p>
        <label class="fld"><span>Tujuan Perjalanan</span><input id="f-tujuan" maxlength="255" placeholder="cth: Mesyuarat penyelarasan" oninput="checkForm()"></label>
        <label class="fld"><span>Destinasi</span><input id="f-destinasi" maxlength="255" placeholder="cth: Putrajaya, Presint 4" oninput="checkForm()"></label>
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
  const telOK = telefonSahJs($("f-tel").value);
  const valid = $("f-pemohon").value.trim() && $("f-bahagian").value.trim() && telOK &&
                $("f-tujuan").value.trim() && $("f-destinasi").value.trim() &&
                tkh && mula && tarikhOK && masaOK && tidakLampau;
  let mesej = `<span class="muted">Masa tamat boleh dibiarkan kosong — ia direkodkan automatik apabila pemandu menanda Selesai. Untuk tempahan bermalam / lebih sehari, isi Tarikh Tamat.</span>`;
  if($("f-tel").value.trim() && !telOK) mesej = `<span class="err">No. telefon tidak sah — sekurang-kurangnya 7 digit.</span>`;
  else if(!tidakLampau) mesej = `<span class="err">Tarikh/masa tempahan tidak boleh pada masa lampau.</span>`;
  else if(!tarikhOK) mesej = `<span class="err">Tarikh tamat mesti pada atau selepas tarikh mula.</span>`;
  else if(sehari && tamat && mula >= tamat) mesej = `<span class="err">Masa tamat mesti selepas masa mula.</span>`;
  $("f-err").innerHTML = mesej;
  $("f-ok").disabled = !valid;
}

async function submitForm(){
  const booking = {
    pemohon: $("f-pemohon").value.trim(),
    bahagian: $("f-bahagian").value.trim(),
    telefon: $("f-tel").value.trim(),
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
      userId: currentUser ? currentUser.userId : null, masaSelesai:"", diterima:"",
      ...booking, telefonPemohon: booking.telefon });
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

/* ---------- Modal: edit tempahan ----------
 * Admin: tempahan menunggu/diluluskan. Pemohon: tempahan sendiri yang masih
 * menunggu kelulusan sahaja (pelayan menguatkuasakan peraturan yang sama).
 * Hanya boleh diedit SELAGI tempahan belum bermula. SOP sama dengan
 * permohonan baharu — tiada pertindihan jadual dibenarkan. */
function openEditForm(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  if(!isAdmin() && b.status !== "menunggu"){
    notify("Tempahan ini telah diproses. Sila hubungi admin untuk sebarang perubahan.", "warn");
    render(); return;
  }
  /* Tempahan sudah bermula DAN disahkan pemandu → tiada perubahan dibenarkan.
     Jika pemandu belum sahkan, admin masih boleh membetulkan tempahan. */
  if(mulaDT(b) <= skrgStr() && b.diterima){
    notify("Tempahan sedang berjalan. Tiada perubahan dibenarkan.", "warn");
    return;
  }
  const v = veh(b.vehicleId), d = drv(b.driverId);
  $("modal-root").innerHTML = `
  <div class="overlay">
    <div class="modal">
      <div class="modal-h"><h3>Edit Tempahan ${b.id}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        ${b.status === "diluluskan" && v ? `<div class="summary" style="margin-bottom:14px">Tugasan semasa: <b>${esc(v.plat)}</b> ${esc(v.model)}${d ? " — " + esc(d.nama) : ""}<br><span class="muted">Perubahan tarikh/masa mesti tiada pertindihan dengan tugasan kenderaan/pemandu ini.</span></div>` : ""}
        <div class="row2">
          <label class="fld"><span>Nama Pemohon</span><input id="e-pemohon" maxlength="150" value="${esc(b.pemohon)}" oninput="checkEditForm('${b.id}')"></label>
          <label class="fld"><span>Bahagian / Unit</span><input id="e-bahagian" maxlength="150" value="${esc(b.bahagian)}" oninput="checkEditForm('${b.id}')"></label>
        </div>
        <label class="fld"><span>No. Telefon Untuk Dihubungi</span><input id="e-tel" type="tel" maxlength="30" value="${esc(b.telefonPemohon || "")}" placeholder="cth: 012-345 6789" oninput="checkEditForm('${b.id}')"></label>
        <label class="fld"><span>Tujuan Perjalanan</span><input id="e-tujuan" maxlength="255" value="${esc(b.tujuan)}" oninput="checkEditForm('${b.id}')"></label>
        <label class="fld"><span>Destinasi</span><input id="e-destinasi" maxlength="255" value="${esc(b.destinasi)}" oninput="checkEditForm('${b.id}')"></label>
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
  const telOK = telefonSahJs($("e-tel").value);
  const isiOK = $("e-pemohon").value.trim() && $("e-bahagian").value.trim() && telOK &&
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
  if($("e-tel").value.trim() && !telOK) mesej = `<span class="err">No. telefon tidak sah — sekurang-kurangnya 7 digit.</span>`;
  else if(!tidakLampau) mesej = `<span class="err">Tarikh/masa tempahan tidak boleh pada masa lampau.</span>`;
  else if(!tarikhOK) mesej = `<span class="err">Tarikh tamat mesti pada atau selepas tarikh mula.</span>`;
  else if(sehari && tamat && mula >= tamat) mesej = `<span class="err">Masa tamat mesti selepas masa mula.</span>`;
  $("e-err").innerHTML = mesej;

  $("e-ok").disabled = !(isiOK && tarikhOK && masaOK && tidakLampau && konflik.length === 0);
}

async function submitEdit(id){
  const b = bookings.find(x => x.id === id);
  if(!b) return;
  /* Semak semula pada saat hantar — mungkin sudah bermula sejak modal dibuka */
  if(mulaDT(b) <= skrgStr() && b.diterima){
    closeModal();
    notify("Tempahan sedang berjalan. Tiada perubahan dibenarkan.", "warn");
    render();
    return;
  }
  const patch = {
    pemohon: $("e-pemohon").value.trim(),
    bahagian: $("e-bahagian").value.trim(),
    telefon: $("e-tel").value.trim(),
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
    Object.assign(b, patch, { telefonPemohon: patch.telefon });
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
      btn.disabled = false; btn.textContent = "Simpan Perubahan";
      return;
    }
    Object.assign(b, res.booking);
    closeModal(); render(); notify(`Tempahan ${id} dikemas kini.`);
  }catch(e){
    $("e-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "Simpan Perubahan";
  }
}
