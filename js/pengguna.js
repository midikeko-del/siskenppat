/* SisKEN — pengguna.js (edit di sini) */
/* ============================================================
   MODUL PENGURUSAN PENGGUNA (admin sahaja)
   ============================================================ */
function renderPengguna(){
  if(!apiAktif() || !TOKEN){
    return `<h2 class="sect">Pengurusan Pengguna</h2>
      <div class="card"><div style="padding:30px;color:var(--slate);font-size:14px;line-height:1.7">
        Modul ini memerlukan sambungan backend (php/api.php) dan log masuk sebenar.<br>
        Tetapkan <b>API_URL</b> di bahagian atas <code>js/core.js</code>, pasang backend PHP (lihat README.md), kemudian log masuk dengan akaun admin untuk menambah dan mengurus pengguna.
      </div></div>`;
  }
  const rows = users.map(u => `<tr>
    <td style="font-family:Consolas,monospace;font-weight:700">${esc(u.userId)}</td>
    <td>${esc(u.nama)}${u.userId === currentUser.userId ? ' <span class="muted">(anda)</span>' : ""}</td>
    <td>${chip(u.peranan === "admin" ? {label:"Admin", cls:"amber"} : u.peranan === "pemandu" ? {label:"Pemandu", cls:"green"} : {label:"Pemohon", cls:"gray"})}${u.peranan === "pemandu" && u.driverId && drv(u.driverId) ? `<div class="muted" style="margin-top:4px">↳ ${esc(drv(u.driverId).nama)}</div>` : ""}</td>
    <td style="white-space:nowrap">
      <button class="btn-edit" onclick="openResetPw('${u.userId}')">🔑 Tukar Kata Laluan</button>
      ${u.userId !== currentUser.userId ? `<button class="btn-del" onclick="askDelUser('${u.userId}')">🗑 Padam</button>` : ""}
    </td>
  </tr>`).join("");

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Pengurusan Pengguna</h2>
      <button class="btn btn-amber" onclick="openUserForm()">＋ Tambah Pengguna</button>
    </div>
    <div class="card"><div class="tbl-scroll"><table>
      <thead><tr><th>ID Pengguna</th><th>Nama</th><th>Peranan</th><th>Tindakan</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--slate-l)">Tiada pengguna.</td></tr>'}</tbody>
    </table></div></div>
    <div class="card"><div style="padding:16px 20px;font-size:13px;color:var(--slate);line-height:1.7">
      <b>Peranan:</b> <b>Admin</b> boleh akses semua modul termasuk kelulusan, kenderaan, laporan dan pengguna.
      <b>Pemandu</b> hanya nampak tugasan mereka sendiri dan boleh menanda selesai (masa sebenar direkodkan). <b>Pemohon</b> hanya boleh menghantar tempahan dan melihat status tempahan mereka sendiri.
      Kata laluan disimpan sebagai cincangan (hash) — tiada sesiapa boleh melihat kata laluan sebenar, termasuk admin.
    </div></div>`;
}

/* Rekod pemandu aktif yang BELUM dipautkan kepada mana-mana akaun (cth. diimport daripada data lama) */
const pemanduTanpaAkaun = () => pemanduAktif().filter(d => !users.some(u => u.driverId === d.id));

function openUserForm(){
  const bebas = pemanduTanpaAkaun();
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:460px">
      <div class="modal-h"><h3>Tambah Pengguna Baharu</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <div class="row2">
          <label class="fld"><span>ID Pengguna</span><input id="u-id" placeholder="cth: staf01" oninput="checkUserForm()"></label>
          <label class="fld"><span>Peranan</span>
            <select id="u-role" onchange="$('u-drv-wrap').style.display = this.value==='pemandu' ? 'block' : 'none'; checkUserForm()">
              <option value="pemohon">Pemohon</option>
              <option value="pemandu">Pemandu</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <label class="fld"><span>Nama Penuh</span><input id="u-nm" placeholder="cth: En. Hafiz Rahman" oninput="checkUserForm()"></label>
        <div id="u-drv-wrap" style="display:none">
          <label class="fld"><span>Rekod Pemandu</span>
            <select id="u-drv" onchange="pilihRekodPemandu()">
              <option value="">＋ Cipta rekod pemandu baharu</option>
              ${bebas.map(d => `<option value="${d.id}">Pautkan: ${esc(d.nama)} (${esc(d.id)})</option>`).join("")}
            </select>
          </label>
          <div id="u-drv-baru">
            <div class="row2">
              <label class="fld"><span>No. Telefon</span><input id="u-drv-tel" placeholder="cth: 012-345 6789" oninput="checkUserForm()"></label>
              <label class="fld"><span>Kelas Lesen</span><input id="u-drv-lesen" placeholder="cth: D, E, GDL" oninput="checkUserForm()"></label>
            </div>
            <p class="muted" style="font-size:12px;margin:-6px 0 12px">Rekod pemandu baharu akan dicipta serentak dengan akaun ini.</p>
          </div>
          <p id="u-drv-paut" class="muted" style="display:none;font-size:12px;margin:-6px 0 12px">Akaun ini akan dipautkan kepada rekod pemandu sedia ada — sejarah tugasannya kekal.</p>
        </div>
        <div class="row2">
          <label class="fld"><span>Kata Laluan</span><input id="u-pw" type="password" oninput="checkUserForm()"></label>
          <label class="fld"><span>Ulang Kata Laluan</span><input id="u-pw2" type="password" oninput="checkUserForm()"></label>
        </div>
        <div id="u-err"></div>
        <button class="btn btn-amber" id="u-ok" style="justify-content:center" onclick="submitUser()">Tambah Pengguna</button>
      </div>
    </div>
  </div>`;
  checkUserForm();
}

/* Pautkan rekod sedia ada -> sembunyi medan telefon/lesen & isi nama daripada rekod */
function pilihRekodPemandu(){
  const d = drv($("u-drv").value);
  $("u-drv-baru").style.display = d ? "none" : "block";
  $("u-drv-paut").style.display = d ? "block" : "none";
  if(d && !$("u-nm").value.trim()) $("u-nm").value = d.nama;
  checkUserForm();
}

function checkUserForm(){
  const pw = $("u-pw").value, pw2 = $("u-pw2").value;
  const isPemandu = $("u-role").value === "pemandu";
  const pautId = isPemandu ? $("u-drv").value : "";
  const drvOK = !isPemandu || pautId || ($("u-drv-tel").value.trim() && $("u-drv-lesen").value.trim());
  let err = "";
  if(pw && pw.length < 6) err = "Kata laluan mestilah sekurang-kurangnya 6 aksara.";
  else if(pw && pw2 && pw !== pw2) err = "Kata laluan tidak sepadan.";
  $("u-err").innerHTML = err ? `<span class="err">${err}</span>` : "";
  $("u-ok").disabled = !($("u-id").value.trim() && $("u-nm").value.trim() && pw.length >= 6 && pw === pw2 && drvOK);
}

async function submitUser(){
  const btn = $("u-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";
  const isPemandu = $("u-role").value === "pemandu";
  const pautId = isPemandu ? $("u-drv").value : "";
  try{
    const res = await api("userAdd", {
      userId: $("u-id").value.trim(),
      nama: $("u-nm").value.trim(),
      peranan: $("u-role").value,
      driverId: pautId || undefined,
      telefon: isPemandu && !pautId ? $("u-drv-tel").value.trim() : undefined,
      lesen: isPemandu && !pautId ? $("u-drv-lesen").value.trim() : undefined,
      password: $("u-pw").value,
    });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("u-err").innerHTML = `<span class="err">${esc(res.ralat)}</span>`;
      btn.disabled = false; btn.textContent = "Tambah Pengguna"; return;
    }
    users = res.users;
    if(res.drivers) drivers = res.drivers;
    closeModal(); render();
    notify("Pengguna ditambah." + (!isPemandu ? "" : pautId ? " Dipautkan kepada rekod pemandu sedia ada." : " Rekod pemandu turut dicipta."));
  }catch(e){
    $("u-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "Tambah Pengguna";
  }
}

function openResetPw(userId){
  const u = users.find(x => x.userId === userId);
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:420px">
      <div class="modal-h"><h3>Tukar Kata Laluan — ${esc(u.nama)}</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <label class="fld"><span>Kata Laluan Baharu</span><input id="r-pw" type="password" oninput="checkResetPw()"></label>
        <label class="fld"><span>Ulang Kata Laluan</span><input id="r-pw2" type="password" oninput="checkResetPw()"></label>
        <div id="r-err"></div>
        <button class="btn btn-amber" id="r-ok" style="justify-content:center" onclick="submitResetPw('${esc(userId)}')">Simpan Kata Laluan</button>
      </div>
    </div>
  </div>`;
  checkResetPw();
}

function checkResetPw(){
  const pw = $("r-pw").value, pw2 = $("r-pw2").value;
  let err = "";
  if(pw && pw.length < 6) err = "Kata laluan mestilah sekurang-kurangnya 6 aksara.";
  else if(pw && pw2 && pw !== pw2) err = "Kata laluan tidak sepadan.";
  $("r-err").innerHTML = err ? `<span class="err">${err}</span>` : "";
  $("r-ok").disabled = !(pw.length >= 6 && pw === pw2);
}

async function submitResetPw(userId){
  const btn = $("r-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";
  try{
    const res = await api("userReset", { userId, password: $("r-pw").value });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("r-err").innerHTML = `<span class="err">${esc(res.ralat)}</span>`;
      btn.disabled = false; btn.textContent = "Simpan Kata Laluan"; return;
    }
    users = res.users;
    closeModal(); render(); notify("Kata laluan dikemas kini.");
  }catch(e){
    $("r-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "Simpan Kata Laluan";
  }
}

function askDelUser(userId){
  const u = users.find(x => x.userId === userId);
  confirmModal("Padam Pengguna",
    `Anda pasti mahu memadam akaun <b>${esc(u.nama)}</b> (${esc(u.userId)})? Pengguna ini tidak akan dapat log masuk lagi.`,
    async () => {
      try{
        const res = await api("userDel", { userId });
        if(res.sesiTamat){ sesiTamat(); return; }
        if(!res.ok){ closeModal(); notify(res.ralat); return; }
        users = res.users;
        closeModal(); render(); notify("Pengguna dipadam.");
      }catch(e){ closeModal(); notify("Gagal menghubungi pelayan."); }
    });
}

/* ============================================================
   TUKAR KATA LALUAN SENDIRI (semua peranan)
   ============================================================ */
function openTukarPwSendiri(){
  if(!currentUser) return;
  if(!apiAktif() || !TOKEN){ notify("Mod demo: tiada kata laluan untuk ditukar."); return; }
  $("modal-root").innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:420px">
      <div class="modal-h"><h3>Tukar Kata Laluan Saya</h3><button class="modal-x" onclick="closeModal()">✕</button></div>
      <div class="modal-b">
        <p class="muted" style="font-size:13px">Akaun: <b>${esc(currentUser.userId)}</b> — ${esc(currentUser.nama)}</p>
        <label class="fld"><span>Kata Laluan Semasa</span><input id="my-pw0" type="password" oninput="checkMyPw()"></label>
        <label class="fld"><span>Kata Laluan Baharu</span><input id="my-pw1" type="password" oninput="checkMyPw()"></label>
        <label class="fld"><span>Ulang Kata Laluan Baharu</span><input id="my-pw2" type="password" oninput="checkMyPw()"></label>
        <div id="my-err"></div>
        <button class="btn btn-amber" id="my-ok" style="justify-content:center" onclick="submitMyPw()">Simpan Kata Laluan</button>
      </div>
    </div>
  </div>`;
  checkMyPw();
}

function checkMyPw(){
  const p0 = $("my-pw0").value, p1 = $("my-pw1").value, p2 = $("my-pw2").value;
  let err = "";
  if(p1 && p1.length < 6) err = "Kata laluan baharu mestilah sekurang-kurangnya 6 aksara.";
  else if(p1 && p2 && p1 !== p2) err = "Kata laluan baharu tidak sepadan.";
  else if(p0 && p1 && p0 === p1) err = "Kata laluan baharu mestilah berbeza daripada yang semasa.";
  $("my-err").innerHTML = err ? `<span class="err">${err}</span>` : "";
  $("my-ok").disabled = !(p0 && p1.length >= 6 && p1 === p2 && p0 !== p1);
}

async function submitMyPw(){
  const btn = $("my-ok"); btn.disabled = true; btn.textContent = "Menyimpan…";
  try{
    const res = await api("tukarPw", {
      passwordLama: $("my-pw0").value,
      passwordBaru: $("my-pw1").value,
    });
    if(res.sesiTamat){ sesiTamat(); return; }
    if(!res.ok){
      $("my-err").innerHTML = `<span class="err">${esc(res.ralat || "Gagal menukar kata laluan.")}</span>`;
      btn.disabled = false; btn.textContent = "Simpan Kata Laluan"; return;
    }
    closeModal(); notify("Kata laluan berjaya ditukar. Gunakan kata laluan baharu pada log masuk akan datang.");
  }catch(e){
    $("my-err").innerHTML = '<span class="err">Gagal menghubungi pelayan.</span>';
    btn.disabled = false; btn.textContent = "Simpan Kata Laluan";
  }
}
