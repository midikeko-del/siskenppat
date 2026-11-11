/* SisKEN — penolakan.js (edit di sini) */
/* ============================================================
   TUGASAN DITOLAK — rekod penolakan tugasan oleh pemandu.
   Admin melihat semua penolakan; pemandu melihat penolakannya sendiri.
   Rekod kekal walaupun tempahan diluluskan semula kemudian.
   (Log Audit tidak berubah — ini paparan khusus sebab penolakan.)

   Pelayan memulangkan 200 rekod terkini; carian & paginasi (20/muka,
   SAIZ_HALAMAN dalam core.js) dilakukan di pelayar atas rekod tersebut.
   ============================================================ */
let penolakanRekod = [];  // rekod dimuat daripada pelayan
let penolakanCari = "";   // teks carian
let penolakanPage = 1;    // muka surat semasa

const KOL_TOLAK = () => (isAdmin() ? 6 : 5);
const selTolak = (isi, warna) =>
  `<tr><td colspan="${KOL_TOLAK()}" style="padding:24px;text-align:center;color:${warna}">${isi}</td></tr>`;

function renderPenolakan(){
  if(!apiAktif() || !TOKEN){
    return `<h2 class="sect">Tugasan Ditolak</h2>
      <div class="card"><div style="padding:30px;color:var(--slate);font-size:14px;line-height:1.7">
        Modul ini memerlukan sambungan pelayan (backend PHP) dan log masuk sebenar.
      </div></div>`;
  }
  setTimeout(muatPenolakan, 0); // muat data selepas paparan dipasang
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Tugasan Ditolak</h2>
      <button class="btn btn-dark" onclick="muatPenolakan()">↻ Muat Semula</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin:-4px 0 6px">
      <p class="muted" style="font-size:13px;margin:0;line-height:1.6;flex:1;min-width:260px">${isAdmin()
        ? 'Tugasan yang ditolak pemandu selepas diluluskan. Tempahan berkenaan telah dikembalikan ke status <b>Menunggu Kelulusan</b> untuk ditugaskan semula kepada kenderaan/pemandu lain.'
        : 'Rekod tugasan yang anda tolak, berserta sebab yang anda berikan.'}</p>
      <input id="tl-cari" type="text" value="${esc(penolakanCari)}"
             placeholder="🔍 Cari ID, sebab, destinasi${isAdmin() ? ", pemandu" : ""}…"
             style="width:auto;min-width:260px" oninput="onPenolakanCari(this.value)">
    </div>
    <div class="card"><div class="tbl-scroll"><table>
      <thead><tr>
        <th>Masa Ditolak</th><th>Tempahan</th>${isAdmin() ? "<th>Pemandu</th>" : ""}
        <th>Kenderaan</th><th>Sebab</th><th>Status Kini</th>
      </tr></thead>
      <tbody id="tolak-body">${selTolak("Memuatkan…", "var(--slate-l)")}</tbody>
    </table></div></div>
    <div id="tolak-pager"></div>`;
}

/* ---------- Carian ---------- */
function penolakanTersenarai(){
  const q = (penolakanCari || "").trim().toLowerCase();
  if(!q) return penolakanRekod;
  return penolakanRekod.filter(r =>
    [r.tempahanId, r.sebab, r.namaPemandu, r.driverId, r.userId, r.tujuan, r.destinasi, r.plat, r.model, r.masa]
      .some(x => String(x || "").toLowerCase().includes(q)));
}

/* ---------- Satu baris rekod ---------- */
function barisPenolakan(r){
  const adaTempahan = !!r.tarikh;
  const trip = adaTempahan
    ? `${paparTarikh({ tarikh:r.tarikh, tarikhTamat:r.tarikhTamat })}, ${esc(r.masaMula || "")}${r.masaTamat ? "–" + esc(r.masaTamat) : ""}`
    : `<span class="muted">Butiran tempahan tiada rekod</span>`;
  const kenderaan = r.plat
    ? `<span class="plat">${esc(r.plat)}</span><div class="muted" style="margin-top:4px">${esc(r.model || "")}</div>`
    : (r.vehicleId ? esc(r.vehicleId) : '<span class="muted">—</span>');
  const statusKini = r.statusKini && BSTATUS[r.statusKini]
    ? chip(BSTATUS[r.statusKini])
    : '<span class="muted">—</span>';
  const pemandu = isAdmin()
    ? `<td>${esc(r.namaPemandu || r.driverId || "—")}<div class="muted" style="margin-top:4px;font-family:Consolas,monospace">${esc(r.userId || "")}</div></td>`
    : "";
  return `<tr>
    <td style="white-space:nowrap">${fmtMasaSelesai(r.masa)}</td>
    <td><span class="id">${esc(r.tempahanId)}</span>
      ${adaTempahan ? `<div style="font-weight:600;margin-top:4px">${esc(r.tujuan || "")}</div>
      <div class="muted">📍 ${esc(r.destinasi || "")}</div>` : ""}
      <div class="muted" style="margin-top:2px">${trip}</div></td>
    ${pemandu}
    <td>${kenderaan}</td>
    <td style="max-width:280px">${esc(r.sebab)}</td>
    <td>${statusKini}</td>
  </tr>`;
}

/* ---------- Senarai + paginasi ---------- */
function penolakanSenaraiHTML(){
  const senarai = penolakanTersenarai();
  if(senarai.length === 0){
    if(penolakanCari.trim()) return selTolak("Tiada rekod sepadan dengan carian.", "var(--slate-l)");
    return selTolak(isAdmin() ? "Tiada tugasan ditolak setakat ini. 👍" : "Anda tiada rekod penolakan tugasan. 👍", "var(--slate-l)");
  }
  // Hadkan muka surat SEBELUM potong senarai (senarai mengecil bila carian ditapis)
  penolakanPage = Math.min(Math.max(1, penolakanPage), Math.ceil(senarai.length / SAIZ_HALAMAN));
  const mula = (penolakanPage - 1) * SAIZ_HALAMAN;
  return senarai.slice(mula, mula + SAIZ_HALAMAN).map(barisPenolakan).join("");
}

function penolakanPagerHTML(){
  const senarai = penolakanTersenarai();
  const jumHalaman = Math.max(1, Math.ceil(senarai.length / SAIZ_HALAMAN));
  if(jumHalaman <= 1) return "";
  if(penolakanPage > jumHalaman) penolakanPage = jumHalaman;
  const mula = (penolakanPage - 1) * SAIZ_HALAMAN + 1;
  const akhir = Math.min(penolakanPage * SAIZ_HALAMAN, senarai.length);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:6px">
      <span class="muted" style="font-size:13px">Memaparkan ${mula}–${akhir} daripada ${senarai.length}</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-dark" style="padding:6px 12px;font-size:13px" ${penolakanPage<=1?"disabled":""} onclick="gerakPenolakanPage(-1)">‹ Sebelum</button>
        <span class="muted" style="font-size:13px">Muka ${penolakanPage} / ${jumHalaman}</span>
        <button class="btn btn-dark" style="padding:6px 12px;font-size:13px" ${penolakanPage>=jumHalaman?"disabled":""} onclick="gerakPenolakanPage(1)">Seterus ›</button>
      </div>
    </div>`;
}

/* Kemas kini jadual sahaja — kotak carian kekal (tidak hilang fokus) */
function segarPenolakanSenarai(){
  const b = $("tolak-body");
  if(!b) return;
  b.innerHTML = penolakanSenaraiHTML();
  const p = $("tolak-pager");
  if(p) p.innerHTML = penolakanPagerHTML();
}
function onPenolakanCari(v){ penolakanCari = v; penolakanPage = 1; segarPenolakanSenarai(); }
function gerakPenolakanPage(d){ penolakanPage += d; segarPenolakanSenarai(); }

/* ---------- Muat daripada pelayan ---------- */
async function muatPenolakan(){
  const b = $("tolak-body");
  if(!b) return;
  const gagal = (msg) => {
    b.innerHTML = selTolak(msg, "var(--red)");
    const p = $("tolak-pager"); if(p) p.innerHTML = "";
  };
  try{
    const res = await api("penolakanList");
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){ gagal(esc(res.ralat || "Gagal memuatkan senarai.")); return; }
    penolakanRekod = res.senarai || [];
    segarPenolakanSenarai();
  }catch(e){
    gagal("Gagal menghubungi pelayan.");
  }
}
