/* SisKEN — manual.js (edit di sini) */
/* ============================================================
   MANUAL PENGGUNA — boleh dibaca sebelum log masuk (paparan umum)
   dan juga dari menu pemandu/pemohon selepas log masuk.
   Dua bahagian: Pemohon dan Pemandu.
   ============================================================ */
function setManualPeranan(p){ manualPeranan = p; render(); }

const langkahManual = (senarai) =>
  `<ol style="margin:0;padding-left:22px;display:grid;gap:14px;line-height:1.7">
    ${senarai.map(l => `<li><b>${l.t}</b><div class="muted" style="margin-top:3px">${l.d}</div></li>`).join("")}
  </ol>`;

const MANUAL_PEMOHON = [
  { t: "Log masuk", d: "Tekan butang <b>Login</b> di penjuru kanan atas. ID pengguna dan kata laluan diberikan oleh pentadbir sistem di Bahagian Khidmat Pengurusan. Tukar kata laluan anda melalui butang 🔑 selepas log masuk kali pertama." },
  { t: "Hantar tempahan baharu", d: "Pergi ke menu <b>Tempahan</b>, tekan <b>＋ Tempahan Baharu</b>, kemudian isikan tujuan perjalanan, destinasi, tarikh, masa dan bilangan penumpang. Butang Hantar hanya aktif apabila semua maklumat wajib lengkap." },
  { t: "No. telefon untuk dihubungi", d: "Medan ini wajib diisi. Pemandu yang ditugaskan akan melihat nombor tersebut untuk menyelaras tempat dan masa berjumpa. Gunakan nombor pegawai yang akan benar-benar mengikuti perjalanan itu." },
  { t: "Masa tamat boleh dibiarkan kosong", d: "Jika anda belum pasti bila perjalanan akan tamat, biarkan medan Masa Tamat kosong. Sistem merekodkannya secara automatik apabila pemandu menandakan tugasan selesai." },
  { t: "Perjalanan lebih daripada sehari", d: "Isikan medan <b>Tarikh Tamat</b>. Kenderaan dan pemandu akan ditempah untuk keseluruhan tempoh tersebut." },
  { t: "Tempahan tidak boleh pada masa lampau", d: "Tarikh dan masa mula mestilah pada masa akan datang. Hantar permohonan seawal mungkin supaya pentadbir sempat menugaskan kenderaan dan pemandu." },
  { t: "Pemberitahuan", d: "Selagi app dibuka, sistem menyemak pelayan setiap minit. Anda akan menerima amaran apabila tempahan anda diluluskan atau ditolak, dan bilangan kemas kini baharu dipaparkan pada tajuk tab pelayar." },
  { t: "Semak status tempahan anda", d: "Senarai di menu Tempahan memaparkan status setiap permohonan. Anda hanya melihat tempahan anda sendiri. Rujuk jadual status di bawah untuk maksud setiap status." },
  { t: "Cari tempahan lama", d: "Gunakan butang penapis status dan kotak carian di atas senarai. Carian meliputi nombor tempahan, destinasi dan tujuan." },
  { t: "Lupa kata laluan", d: "Hubungi pentadbir sistem untuk menetapkan semula kata laluan anda. Atas sebab keselamatan, kata laluan tidak boleh dilihat oleh sesiapa, termasuk pentadbir." },
];

const MANUAL_PEMANDU = [
  { t: "Log masuk", d: "Tekan butang <b>Login</b> di penjuru kanan atas dan gunakan ID yang diberikan oleh pentadbir sistem. Menu <b>Tugasan Saya</b> akan terus terbuka." },
  { t: "Pemberitahuan tugasan baharu", d: "Selagi app dibuka, sistem menyemak pelayan setiap minit. Apabila anda ditugaskan kepada tempahan baharu, amaran akan dipaparkan dan bilangan tugasan yang belum diterima muncul sebagai lencana merah pada menu <b>Tugasan Saya</b>." },
  { t: "Terima tugasan — langkah wajib", d: "Apabila pentadbir meluluskan sesuatu tempahan, ia muncul dalam Tugasan Saya dengan butang <b>✔ Terima Tugas</b>. Tekan butang tersebut untuk mengesahkan anda menerima tugasan itu. Selagi belum diterima, pentadbir akan melihat amaran bahawa tugasan ini belum disahkan." },
  { t: "Kenderaan disediakan 30 minit lebih awal", d: "Sebaik anda menerima tugasan, kenderaan berkenaan ditanda <b>Tidak Tersedia</b> bermula 30 minit sebelum masa bertolak, supaya anda sempat menyediakan kenderaan tanpa ia ditempah oleh orang lain." },
  { t: "Tugasan yang ditukar oleh pentadbir", d: "Jika pentadbir menukar kenderaan atau pemandu sebelum perjalanan bermula, pengesahan anda terbatal dan butang <b>✔ Terima Tugas</b> akan muncul semula. Sila semak butiran kenderaan yang baharu sebelum menerimanya." },
  { t: "Menolak tugasan", d: "Jika anda tidak dapat menjalankan tugasan tersebut — cuti kecemasan, bertindih dengan tugas lain — tekan <b>✕ Tolak</b> dan nyatakan sebabnya. Tempahan akan dikembalikan kepada pentadbir untuk ditugaskan kepada pemandu lain. Tugasan yang sudah anda terima tidak boleh ditolak; hubungi pentadbir." },
  { t: "Tandakan tugasan selesai", d: "Butang <b>✔ Tandakan Selesai</b> hanya muncul selepas anda menerima tugasan dan perjalanan telah bermula. Anda perlu mengisi bacaan odometer, paras bahan api dan lokasi kenderaan sebelum menghantar. Masa selesai direkodkan automatik oleh pelayan." },
  { t: "Menghubungi pemohon", d: "Setelah tugasan diluluskan, nombor telefon pemohon dipaparkan pada kad tugasan anda. Tekan nombor tersebut untuk terus mendail. Nombor anda juga dipaparkan kepada pemohon bagi tempahan tersebut sahaja." },
  { t: "Bacaan odometer", d: "Odometer tidak boleh kurang daripada bacaan terakhir kenderaan tersebut. Jika bacaan sebenar lebih rendah, hubungi pentadbir sistem — kemungkinan terdapat kesilapan rekod sebelum ini." },
  { t: "Status Bertugas / Cuti", d: "Panel di bahagian atas Tugasan Saya membolehkan anda menukar status sendiri. Ketika status Cuti, anda tidak akan ditugaskan kepada tempahan baharu, dan jadual pemandu akan menunjukkan anda bercuti." },
  { t: "Semak tugasan yang anda tolak", d: "Menu <b>🚫 Tugasan Ditolak</b> memaparkan rekod tugasan yang pernah anda tolak berserta sebab yang anda berikan." },
  { t: "Lupa kata laluan", d: "Hubungi pentadbir sistem untuk menetapkan semula kata laluan anda." },
];

function renderManual(){
  const pilih = (key, label) =>
    `<button class="btn ${manualPeranan===key?'btn-amber':'btn-dark'}" onclick="setManualPeranan('${key}')">${label}</button>`;
  const pemandu = manualPeranan === "pemandu";
  const langkah = pemandu ? MANUAL_PEMANDU : MANUAL_PEMOHON;

  const statusRows = [
    ["menunggu", "Permohonan telah dihantar dan sedang menunggu pentadbir menugaskan kenderaan serta pemandu."],
    ["diluluskan", "Kenderaan dan pemandu telah ditugaskan. Pemandu perlu menerima tugasan sebelum perjalanan dianggap disahkan."],
    ["selesai", "Perjalanan telah tamat dan pemandu telah mengemas kini keadaan kenderaan."],
    ["ditolak", "Permohonan tidak diluluskan. Hubungi pentadbir sistem untuk penjelasan."],
  ].map(([k, d]) => `<tr><td style="white-space:nowrap">${chip(BSTATUS[k])}</td><td class="muted">${d}</td></tr>`).join("");

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <h2 class="sect">Manual Pengguna</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${pilih("pemohon", "👤 Pemohon")}${pilih("pemandu", "🚘 Pemandu")}</div>
    </div>
    <p class="muted" style="font-size:14px;margin:-4px 0 4px;line-height:1.7">
      ${pemandu
        ? "Panduan untuk pemandu yang menerima dan melaksanakan tugasan pemanduan."
        : "Panduan untuk kakitangan yang memohon kenderaan jabatan untuk urusan rasmi."}
    </p>

    <div class="card">
      <div class="card-h"><h3>${pemandu ? "🚘 Langkah demi langkah — Pemandu" : "👤 Langkah demi langkah — Pemohon"}</h3></div>
      <div style="padding:20px 24px">${langkahManual(langkah)}</div>
    </div>

    <div class="card">
      <div class="card-h"><h3>🏷️ Maksud status tempahan</h3></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Status</th><th>Maksud</th></tr></thead>
        <tbody>${statusRows}</tbody>
      </table></div>
    </div>

    <div class="card">
      <div class="card-h"><h3>❓ Bantuan</h3></div>
      <div style="padding:20px 24px;font-size:14px;color:var(--slate);line-height:1.8">
        Untuk akaun baharu, tetapan semula kata laluan, atau sebarang masalah penggunaan sistem,
        hubungi pentadbir sistem di <b>Bahagian Khidmat Pengurusan, Perbadanan Perpustakaan Awam Terengganu</b>.<br>
        Paparan jadual di menu <b>Jadual &amp; Tempahan</b> boleh dilihat tanpa log masuk, jadi anda boleh menyemak
        pergerakan kenderaan dan jadual pemandu pada bila-bila masa.
      </div>
    </div>`;
}
