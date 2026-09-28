/* SisKEN — pemandu.js (edit di sini) */
/* ---------- JADUAL PEMANDU ---------- */
function mingguNav(delta){ mingguOffset += delta; render(); }
function mingguIni(){ mingguOffset = 0; render(); }

function renderPemandu(){
  const minggu = mingguUntuk(mingguOffset);
  const head = minggu.map((t,i) =>
    `<th style="${t===HARI_INI?'color:var(--amber-d)':''}">${HARI[i]}<br><span style="font-weight:400;text-transform:none">${fmtTarikh(t)}</span></th>`
  ).join("");

  const rows = pemanduAktif().map(d => {
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

    return `<tr>
      <td style="min-width:220px">
        <div class="drv-nm">${esc(d.nama)}</div>
        <div class="drv-info">📞 ${esc(d.telefon)} · Lesen ${esc(d.lesen)}</div>
        <button class="toggle ${d.status==='bertugas'?'on':'off2'}" onclick="toggleDriver('${d.id}')">
          ${d.status==='bertugas' ? '● Bertugas' : '○ Cuti'}
        </button>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-edit" onclick="openDrvForm('${d.id}')">✎ Edit</button>
          <button class="btn-del" onclick="askDelDriver('${d.id}')">🗑 Padam</button>
        </div>
      </td>${cells}
    </tr>`;
  }).join("");

  const labelMinggu = mingguOffset === 0 ? "Minggu Ini"
    : mingguOffset === 1 ? "Minggu Hadapan"
    : mingguOffset === -1 ? "Minggu Lepas"
    : (mingguOffset > 0 ? `${mingguOffset} minggu akan datang` : `${-mingguOffset} minggu lepas`);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Jadual Pemandu</h2>
      <button class="btn btn-dark" onclick="tab='pengguna';render()">👥 Tambah Pemandu Baharu (melalui Pengguna)</button>
    </div>
    <p class="muted" style="font-size:13px;margin:-4px 0 4px">Pemandu baharu mesti ditambah sebagai akaun Pengguna (peranan: Pemandu) — rekod pemandu dicipta serentak dengan akaun log masuknya. Di sini anda hanya boleh mengedit atau mengarkibkan rekod sedia ada.</p>
    <div class="card">
      <div class="card-h">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-dark" style="padding:7px 14px;font-size:17px;line-height:1" onclick="mingguNav(-1)" title="Minggu sebelum">‹</button>
          <button class="btn ${mingguOffset===0?'btn-dark':'btn-amber'}" style="padding:8px 14px" onclick="mingguIni()">📅 Minggu Ini</button>
          <button class="btn btn-dark" style="padding:7px 14px;font-size:17px;line-height:1" onclick="mingguNav(1)" title="Minggu seterusnya">›</button>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${fmtTarikh(minggu[0])} – ${fmtTarikh(minggu[6])}</div>
          <div class="muted">${labelMinggu}</div>
        </div>
      </div>
      <div class="tbl-scroll">
        <table class="sched">
          <thead><tr><th>Pemandu</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
function toggleDriver(id){
  const d = drv(id); d.status = d.status === "bertugas" ? "cuti" : "bertugas"; sync();
}

/* ============================================================
   TAMBAH / EDIT / PADAM PEMANDU
   ============================================================ */
/* Edit rekod pemandu SEDIA ADA sahaja — rekod baharu hanya dicipta melalui
   tab Pengguna (bersama akaun log masuk pemandu tersebut). */
function openDrvForm(id){
  const d = drv(id);
  if(!d) return;
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <div class="modal-h"><h3>Edit Pemandu</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <label class="fld"><span>Nama Penuh</span><input id="d-nama" value="${esc(d.nama)}" placeholder="cth: En. Ahmad bin Ali" oninput="checkDrvForm()"></label>
        <div class="row2">
          <label class="fld"><span>No. Telefon</span><input id="d-tel" value="${esc(d.telefon)}" placeholder="cth: 012-345 6789" oninput="checkDrvForm()"></label>
          <label class="fld"><span>Kelas Lesen</span><input id="d-lesen" value="${esc(d.lesen)}" placeholder="cth: D, E, GDL" oninput="checkDrvForm()"></label>
        </div>
        <label class="fld"><span>Status</span>
          <select id="d-status">
            <option value="bertugas" ${d.status==="bertugas"?"selected":""}>Bertugas</option>
            <option value="cuti" ${d.status==="cuti"?"selected":""}>Cuti</option>
          </select>
        </label>
        <button class="btn btn-amber" id="d-ok" style="justify-content:center" onclick="submitDrv('${d.id}')">Simpan Perubahan</button>
      </div>
    </div>
  </div>`;
  checkDrvForm();
}

function checkDrvForm(){
  $("d-ok").disabled = !($("d-nama").value.trim() && $("d-tel").value.trim() && $("d-lesen").value.trim());
}

function submitDrv(id){
  const data = {
    nama: $("d-nama").value.trim(),
    telefon: $("d-tel").value.trim(),
    lesen: $("d-lesen").value.trim(),
    status: $("d-status").value,
  };
  Object.assign(drv(id), data);
  notify(`Maklumat pemandu dikemas kini.`);
  closeModal(); sync();
}

function askDelDriver(id){
  const d = drv(id);
  const aktif = bookings.filter(b => b.driverId === id && b.status === "diluluskan");
  if(aktif.length){
    confirmModal("Tidak Boleh Dipadam",
      `Pemandu <b>${esc(d.nama)}</b> mempunyai ${aktif.length} tugasan aktif (${aktif.map(a=>a.id).join(", ")}). Sila selesaikan atau tugaskan semula tempahan tersebut dahulu.`,
      null);
    return;
  }
  confirmModal("Arkibkan Pemandu",
    `Anda pasti mahu mengarkibkan <b>${esc(d.nama)}</b>? Ia akan disembunyikan daripada senarai pemandu, tetapi rekod sejarah & laporan kekal utuh.`,
    () => {
      drv(id).status = "dipadam";       // soft-delete — kekalkan rujukan sejarah
      closeModal(); sync(); notify(`Pemandu ${d.nama} diarkibkan.`);
    }, "🗑 Ya, Arkibkan", "btn-red");
}
