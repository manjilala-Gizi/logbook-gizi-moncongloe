/* Logbook Petugas Gizi - UPTD Puskesmas Moncongloe
 * Penyimpanan lokal, tampilan, dan form catatan harian.
 * Identitas petugas TIDAK ditulis di kode (repo GitHub publik); diisi di Pengaturan.
 */
'use strict';

var APP_VERSI = '1.1.0';

var SLOT_ISI = ['08.00-09.00', '09.00-10.00', '10.00-11.00', '11.00-12.00'];
/* Susunan baris logbook shift pagi (07.00-14.15), mengikuti format Excel Puskesmas */
var SUSUNAN_HARI = [
  { jam: '07.00-08.00', tetap: 'ABSENSI dan PERSIAPAN KEGIATAN' },
  { jam: '08.00-09.00' },
  { jam: '09.00-10.00' },
  { jam: '10.00-11.00' },
  { jam: '11.00-12.00' },
  { jam: '12.00-13.00', tetap: 'ISTIRAHAT', penuh: true },
  { jam: '13.00-14.15', tetap: 'MEMBUAT LAPORAN' }
];

var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/* Master bawaan = Matrik EKIN 2026. Setelah sinkron, diganti isi tab Master_RA di Google Sheet. */
var MASTER_BAWAAN = [
  { kode: 'RA01', no: '1', rhk: 'Menyiapkan perangkat lunak pelayanan, makanan dan dietetik', ra: 'Menyajikan rancangan rencana bulanan', target: '10', satuan: 'dokumen', bulan: [0,1,1,1,1,1,1,1,1,1,1,0], bukti: 'RPK bulanan', aktif: true },
  { kode: 'RA02', no: '1', rhk: 'Menyiapkan perangkat lunak pelayanan, makanan dan dietetik', ra: 'Menyajikan rancangan rencana tahunan', target: '1', satuan: 'dokumen', bulan: [1,0,0,0,0,0,0,0,0,0,0,0], bukti: 'RUK 2026', aktif: true },
  { kode: 'RA03', no: '2', rhk: 'Menyiapkan penanggulangan masalah gizi, makanan dan dietetik', ra: 'Mengumpulkan data tentang pelaksanaan kegiatan posyandu, keluarga untuk konsumsi gizi, KMS balita, balok SKDN, bahan pangan setempat untuk keperluan penyusunan dan pengembangan resep-resep makanan PMT, penyuluhan dan pemulihan', target: '12', satuan: 'laporan', bulan: [1,1,1,1,1,1,1,1,1,1,1,1], bukti: 'Laporan bulanan', aktif: true },
  { kode: 'RA04', no: '3', rhk: 'Melaksanakan pelayanan gizi, makanan dan dietetik', ra: 'Melakukan penilaian hasil pengukuran berat badan, tinggi badan, umur terhadap standar setiap 10 orang', target: '12', satuan: 'laporan', bulan: [1,1,1,1,1,1,1,1,1,1,1,1], bukti: 'Laporan Rekap Status Gizi', aktif: true },
  { kode: 'RA05', no: '3', rhk: 'Melaksanakan pelayanan gizi, makanan dan dietetik', ra: 'Melakukan pelatihan bagi instansi unit kerja lintas program, lintas sektor', target: '1', satuan: 'laporan', bulan: [0,0,0,0,0,0,1,0,0,0,0,0], bukti: 'Laporan pelatihan PMT', aktif: true },
  { kode: 'RA06', no: '4', rhk: 'Mengevaluasi di bidang pelayanan gizi, makanan dan dietetik', ra: 'Mengevaluasi hasil kegiatan pelayanan gizi (pengukuran tinggi badan, berat badan, umur) di akhir kegiatan secara analitik', target: '10', satuan: 'laporan', bulan: [0,1,1,1,1,1,1,1,1,1,1,0], bukti: 'Laporan BOK', aktif: true }
];

/* ---------- Penyimpanan lokal ---------- */
var simpan = {
  ambil: function (k, bawaan) {
    try { var v = localStorage.getItem('lbg_' + k); return v ? JSON.parse(v) : bawaan; }
    catch (e) { return bawaan; }
  },
  taruh: function (k, v) {
    try { localStorage.setItem('lbg_' + k, JSON.stringify(v)); return true; }
    catch (e) { beritahu('Gagal menyimpan di perangkat: ' + e.message); return false; }
  }
};

var S = {
  profil: simpan.ambil('profil', { nama: '', nip: '', pangkat: '', jabatan: '', upd: '', kotor: false }),
  koneksi: simpan.ambil('koneksi', { url: '', kode: '' }),
  master: simpan.ambil('master', null) || MASTER_BAWAAN,
  masterInfo: simpan.ambil('masterInfo', { sumber: 'bawaan', waktu: '' }),
  catatan: simpan.ambil('catatan', []),
  sinkron: simpan.ambil('sinkron', { terakhir: '', galat: '' })
};
function simpanCatatan() { simpan.taruh('catatan', S.catatan); }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

/* ---------- Utilitas ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function tglStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hariIni() { return tglStr(new Date()); }
function keDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function geserTgl(s, n) { var d = keDate(s); d.setDate(d.getDate() + n); return tglStr(d); }
function tglPanjang(s) { var d = keDate(s); return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
function tglSedang(s) { var d = keDate(s); return d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
function sekarangISO() { return new Date().toISOString(); }
function buatId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
var _tmrBeritahu;
function beritahu(pesan, lama) {
  var el = $('pemberitahuan'); el.textContent = pesan; el.style.display = 'block';
  clearTimeout(_tmrBeritahu); _tmrBeritahu = setTimeout(function () { el.style.display = 'none'; }, lama || 2600);
}

function cariRA(kode) { for (var i = 0; i < S.master.length; i++) if (S.master[i].kode === kode) return S.master[i]; return null; }
function catatanHidup() { return S.catatan.filter(function (c) { return !c.del; }); }
function waktuPelaksanaan(b) {
  var rentang = [], mulai = -1;
  for (var i = 0; i <= 12; i++) {
    if (i < 12 && b[i]) { if (mulai < 0) mulai = i; }
    else if (mulai >= 0) { rentang.push(mulai === i - 1 ? NAMA_BULAN[mulai] : NAMA_BULAN[mulai] + ' s/d ' + NAMA_BULAN[i - 1]); mulai = -1; }
  }
  return rentang.length ? rentang.join(', ') : '-';
}
function urutCatatan(a, b) {
  if (a.tgl !== b.tgl) return a.tgl < b.tgl ? 1 : -1;
  if (a.slot !== b.slot) return a.slot < b.slot ? 1 : -1;
  return (a.dibuat || a.upd) < (b.dibuat || b.upd) ? 1 : -1;
}
function urutHarian(a, b) { return (a.dibuat || a.upd) < (b.dibuat || b.upd) ? -1 : 1; }
function catatanTanggal(tgl) { return catatanHidup().filter(function (c) { return c.tgl === tgl; }); }
function tampilLink(url) {
  if (!url) return '-';
  var aman = /^https?:\/\//i.test(url);
  return aman ? '<a class="link-bukti" href="' + esc(url) + '" target="_blank" rel="noopener">Buka tautan</a>' : '<span class="link-bukti">' + esc(url) + '</span>';
}

/* ---------- Navigasi ---------- */
var halAktif = 'ra';
function buka(hal) {
  halAktif = hal;
  ['ra', 'harian', 'capaian', 'cetak', 'atur'].forEach(function (h) { $('hal-' + h).classList.toggle('sembunyi', h !== hal); });
  Array.prototype.forEach.call(document.querySelectorAll('#menu button'), function (b) { b.classList.toggle('aktif', b.getAttribute('data-hal') === hal); });
  if (hal === 'atur') isiFormAtur();
  segarkan();
  window.scrollTo(0, 0);
}
function segarkan() {
  if (halAktif === 'ra') tampilRA();
  if (halAktif === 'harian') tampilHarian();
  if (halAktif === 'cetak') tampilCetak();
  if (halAktif === 'capaian' && window.tampilCapaian) tampilCapaian();
  if (halAktif === 'atur') tampilAtur();
  if (modalTerbuka()) tampilRiwayat();
  if (window.perbaruiBadge) perbaruiBadge();
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('#menu button'); if (b) { buka(b.getAttribute('data-hal')); return; }
  var k = e.target.closest('[data-ke]'); if (k) { e.preventDefault(); buka(k.getAttribute('data-ke')); }
});

/* ---------- Halaman Rencana Aksi ---------- */
function tampilRA() {
  $('sapaanAtur').classList.toggle('sembunyi', !!S.profil.nama);
  var filter = $('filterRA').value, cari = $('cariRA').value.trim().toLowerCase();
  var bln = new Date().getMonth();
  var hitung = {};
  catatanHidup().forEach(function (c) { hitung[c.kode] = (hitung[c.kode] || 0) + 1; });
  var daftar = S.master.filter(function (m) {
    if (!m.aktif && !hitung[m.kode]) return false;
    if (filter === 'bulan' && !m.bulan[bln]) return false;
    if (cari && (m.ra + ' ' + m.rhk + ' ' + m.kode).toLowerCase().indexOf(cari) < 0) return false;
    return true;
  });
  if (!daftar.length) { $('isiRA').innerHTML = '<tr><td colspan="5" class="kosong">Tidak ada Rencana Aksi yang cocok.</td></tr>'; return; }
  $('isiRA').innerHTML = daftar.map(function (m, i) {
    return '<tr class="' + (m.aktif ? '' : 'nonaktif') + '">' +
      '<td class="tengah no">' + (i + 1) + '.</td>' +
      '<td><span class="ra-teks">' + esc(m.ra) + '</span> <span class="rincian-link" data-rincian="' + esc(m.kode) + '">(Rincian ⇕)</span>' +
      '<div class="detail-ra" id="det-' + esc(m.kode) + '"><div class="label-rhk">RHK ' + esc(m.no) + '</div>' + esc(m.rhk) +
      '<div style="margin-top:4px">Target: <b>' + esc(m.target) + ' ' + esc(m.satuan) + '</b> · Bukti dukung: ' + esc(m.bukti || '-') + ' · Kode: ' + esc(m.kode) + (m.aktif ? '' : ' · <b>nonaktif</b>') + '</div></div></td>' +
      '<td class="tengah waktu">' + esc(waktuPelaksanaan(m.bulan)) + '</td>' +
      '<td class="tengah jml">' + (hitung[m.kode] || 0) + '</td>' +
      '<td class="tengah aksi">' + (m.aktif ? '<button class="ikon-btn tambah" data-tambah="' + esc(m.kode) + '" aria-label="Tambah catatan">+</button>' : '') + '</td></tr>';
  }).join('');
}
$('filterRA').addEventListener('change', tampilRA);
$('cariRA').addEventListener('input', tampilRA);
$('isiRA').addEventListener('click', function (e) {
  var r = e.target.closest('[data-rincian]');
  if (r) { $('det-' + r.getAttribute('data-rincian')).classList.toggle('buka'); return; }
  var t = e.target.closest('[data-tambah]');
  if (t) bukaModal({ kode: t.getAttribute('data-tambah') });
});

/* ---------- Modal Tambah / Ubah Catatan ---------- */
var M = { kode: '', editId: null, pilihBebas: false };
function modalTerbuka() { return $('modal').classList.contains('buka'); }

function bukaModal(opsi) {
  M.kode = opsi.kode || '';
  M.editId = null;
  M.pilihBebas = !!opsi.pilihRA;
  $('wadahPilihRA').classList.toggle('sembunyi', !M.pilihBebas);
  if (M.pilihBebas) {
    $('pilihRA').innerHTML = '<option value="">-- Pilih Rencana Aksi --</option>' + S.master.filter(function (m) { return m.aktif; }).map(function (m) {
      return '<option value="' + esc(m.kode) + '">' + esc(m.kode + ' · ' + m.ra) + '</option>';
    }).join('');
    $('pilihRA').value = M.kode;
  }
  kosongkanForm(opsi.tgl || hariIni(), opsi.slot || '');
  isiPita();
  $('modal').classList.add('buka');
  document.body.style.overflow = 'hidden';
  if (opsi.editId) mulaiEdit(opsi.editId);
  tampilRiwayat();
  setTimeout(function () { (M.pilihBebas && !M.kode ? $('pilihRA') : $('fRincian')).focus(); }, 60);
}
function tutupModal() {
  $('modal').classList.remove('buka');
  document.body.style.overflow = '';
  segarkan();
}
function isiPita() {
  var m = cariRA(M.kode);
  $('mRHK').textContent = m ? m.rhk : '-';
  $('mRA').textContent = m ? m.ra : 'Pilih Rencana Aksi terlebih dahulu';
  $('mInfo').textContent = m ? ('Target ' + m.target + ' ' + m.satuan + ' · Waktu: ' + waktuPelaksanaan(m.bulan) + ' · Bukti dukung: ' + (m.bukti || '-')) : '';
}
function isiPilihanSlot(pilih) {
  var tgl = $('fTgl').value;
  var ada = {};
  catatanTanggal(tgl).forEach(function (c) { if (c.id !== M.editId) ada[c.slot] = (ada[c.slot] || 0) + 1; });
  $('fSlot').innerHTML = '<option value="">-- Pilih jam --</option>' + SLOT_ISI.map(function (s) {
    return '<option value="' + s + '">' + s + (ada[s] ? '  (sudah ' + ada[s] + ' kegiatan)' : '') + '</option>';
  }).join('');
  if (pilih) $('fSlot').value = pilih;
  $('infoSlot').textContent = 'Jam 07.00-08.00 (Absensi), 12.00-13.00 (Istirahat), dan 13.00-14.15 (Membuat Laporan) terisi otomatis di Excel.';
}
function kosongkanForm(tgl, slot) {
  $('fTgl').max = hariIni();
  $('fTgl').value = tgl;
  isiPilihanSlot(slot);
  $('fRincian').value = ''; $('fRealisasi').value = ''; $('fLink').value = ''; $('fOutput').checked = false;
  $('tandaEdit').classList.add('sembunyi');
  $('btnSimpan').innerHTML = '💾 Simpan';
  $('judulModal').textContent = 'Tambah Catatan Kegiatan Harian';
}
function mulaiEdit(id) {
  var c = S.catatan.filter(function (x) { return x.id === id; })[0]; if (!c) return;
  M.editId = id;
  if (c.kode !== M.kode) { M.kode = c.kode; if (M.pilihBebas) $('pilihRA').value = c.kode; isiPita(); }
  $('fTgl').value = c.tgl; isiPilihanSlot(c.slot);
  $('fRincian').value = c.rincian; $('fRealisasi').value = c.realisasi || ''; $('fLink').value = c.link || ''; $('fOutput').checked = !!c.output;
  $('tandaEdit').classList.remove('sembunyi');
  $('btnSimpan').innerHTML = '💾 Simpan Perubahan';
  $('judulModal').textContent = 'Ubah Catatan Kegiatan Harian';
  $('modal').scrollTop = 0;
  $('fRincian').focus();
}
function tampilRiwayat() {
  if (!M.kode) { $('isiRiwayat').innerHTML = '<tr><td colspan="7" class="kosong">Pilih Rencana Aksi untuk melihat riwayat catatannya.</td></tr>'; return; }
  var d = catatanHidup().filter(function (c) { return c.kode === M.kode; }).sort(urutCatatan);
  if (!d.length) { $('isiRiwayat').innerHTML = '<tr><td colspan="7" class="kosong">Belum ada catatan untuk Rencana Aksi ini.</td></tr>'; return; }
  $('isiRiwayat').innerHTML = d.map(function (c, i) {
    return '<tr' + (c.id === M.editId ? ' style="background:#fff7e0"' : '') + '><td class="tengah">' + (i + 1) + '.</td><td class="tengah">' + esc(tglSedang(c.tgl)) + '</td><td class="tengah nowrap">' + esc(c.slot) + '</td><td>' + esc(c.rincian) + (c.output ? ' <span class="lencana">Output ✓</span>' : '') +
      '</td><td>' + esc(c.realisasi || '') + '</td><td class="tengah">' + tampilLink(c.link) +
      '</td><td class="tengah nowrap"><button class="ikon-btn edit" data-edit="' + esc(c.id) + '" aria-label="Ubah">✎</button> <button class="ikon-btn hapus" data-hapus="' + esc(c.id) + '" aria-label="Hapus">✖</button></td></tr>';
  }).join('');
}
function simpanForm() {
  if (!M.kode) { beritahu('Pilih Rencana Aksi terlebih dahulu.'); $('pilihRA').focus(); return; }
  var tgl = $('fTgl').value, slot = $('fSlot').value, rincian = $('fRincian').value.trim();
  var realisasi = $('fRealisasi').value.trim(), link = $('fLink').value.trim(), output = $('fOutput').checked;
  if (!tgl) { beritahu('Tanggal belum diisi.'); $('fTgl').focus(); return; }
  if (tgl > hariIni()) { beritahu('Tanggal tidak boleh melewati hari ini.'); $('fTgl').focus(); return; }
  if (!slot) { beritahu('Pilih jam kegiatan.'); $('fSlot').focus(); return; }
  if (!rincian) { beritahu('Rincian Kegiatan Harian wajib diisi.'); $('fRincian').focus(); return; }
  if (link && !/^https?:\/\//i.test(link)) { beritahu('Tautan harus diawali https://'); $('fLink').focus(); return; }
  if (output && !link && !confirm('Output ditandai selesai tetapi Link Bukti kosong.\nBukti dukung di Matrik Realisasi akan kosong untuk bulan ini. Tetap simpan?')) { $('fLink').focus(); return; }
  var waktu = sekarangISO();
  if (M.editId) {
    var c = S.catatan.filter(function (x) { return x.id === M.editId; })[0];
    if (c) { c.kode = M.kode; c.tgl = tgl; c.slot = slot; c.rincian = rincian; c.realisasi = realisasi; c.link = link; c.output = output; c.upd = waktu; c.kotor = true; }
  } else {
    S.catatan.push({ id: buatId(), kode: M.kode, tgl: tgl, slot: slot, rincian: rincian, realisasi: realisasi, link: link, output: output, dibuat: waktu, upd: waktu, del: false, kotor: true });
  }
  simpanCatatan();
  beritahu(M.editId ? 'Perubahan tersimpan.' : 'Catatan tersimpan.');
  var tetapTgl = tgl;
  kosongkanForm(tetapTgl, '');
  M.editId = null;
  tampilRiwayat();
  if (window.jadwalSinkron) jadwalSinkron();
}
function hapusCatatan(id) {
  var c = S.catatan.filter(function (x) { return x.id === id; })[0]; if (!c) return;
  if (!confirm('Hapus catatan tanggal ' + tglSedang(c.tgl) + ' jam ' + c.slot + '?\n\n"' + c.rincian.slice(0, 120) + '"')) return;
  c.del = true; c.upd = sekarangISO(); c.kotor = true;
  simpanCatatan();
  if (M.editId === id) kosongkanForm($('fTgl').value, '');
  beritahu('Catatan dihapus.');
  segarkan();
  if (window.jadwalSinkron) jadwalSinkron();
}
$('btnSimpan').addEventListener('click', simpanForm);
$('btnTutup').addEventListener('click', tutupModal);
$('modal').addEventListener('click', function (e) { if (e.target === $('modal')) tutupModal(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalTerbuka()) tutupModal(); });
$('fTgl').addEventListener('change', function () { isiPilihanSlot($('fSlot').value); });
$('pilihRA').addEventListener('change', function () { M.kode = $('pilihRA').value; M.editId = null; $('tandaEdit').classList.add('sembunyi'); isiPita(); tampilRiwayat(); });
$('batalEdit').addEventListener('click', function (e) { e.preventDefault(); M.editId = null; kosongkanForm($('fTgl').value, ''); tampilRiwayat(); });
$('isiRiwayat').addEventListener('click', function (e) {
  var ed = e.target.closest('[data-edit]'); if (ed) { mulaiEdit(ed.getAttribute('data-edit')); tampilRiwayat(); return; }
  var h = e.target.closest('[data-hapus]'); if (h) hapusCatatan(h.getAttribute('data-hapus'));
});

/* ---------- Halaman Harian ---------- */
function tampilHarian() {
  if (!$('tglHarian').value) $('tglHarian').value = hariIni();
  $('tglHarian').max = hariIni();
  var tgl = $('tglHarian').value;
  $('tglMaju').disabled = tgl >= hariIni();
  $('labelHarian').textContent = tglPanjang(tgl);
  var semua = catatanTanggal(tgl).sort(urutHarian);
  $('isiHarian').innerHTML = SUSUNAN_HARI.map(function (b, i) {
    if (b.tetap) return '<tr class="slot-tetap"><td>' + (i + 1) + '</td><td class="nowrap">' + b.jam + '</td><td colspan="2">' + esc(b.tetap) + '</td></tr>';
    var isi = semua.filter(function (c) { return c.slot === b.jam; });
    var html = isi.length ? isi.map(function (c) {
      var m = cariRA(c.kode);
      return '<div class="entri"><div class="isi"><div>' + esc(c.rincian) + (c.realisasi ? ' · <b>' + esc(c.realisasi) + '</b>' : '') + (c.output ? ' <span class="lencana">Output ✓</span>' : '') + '</div>' +
        '<div class="ra-kecil">' + esc(m ? m.kode + ' · ' + m.ra : c.kode) + '</div>' + (c.link ? '<div>' + tampilLink(c.link) + '</div>' : '') + '</div>' +
        '<button class="ikon-btn edit" data-hedit="' + esc(c.id) + '" aria-label="Ubah">✎</button></div>';
    }).join('') : '<span class="catatan-kecil">— belum ada kegiatan —</span>';
    return '<tr><td class="tengah">' + (i + 1) + '</td><td class="nowrap">' + b.jam + '</td><td>' + html + '</td><td class="tengah"><button class="ikon-btn tambah" data-hslot="' + b.jam + '" aria-label="Tambah kegiatan">+</button></td></tr>';
  }).join('');
}
$('tglHarian').addEventListener('change', tampilHarian);
$('tglMundur').addEventListener('click', function () { $('tglHarian').value = geserTgl($('tglHarian').value || hariIni(), -1); tampilHarian(); });
$('tglMaju').addEventListener('click', function () { var n = geserTgl($('tglHarian').value || hariIni(), 1); if (n <= hariIni()) { $('tglHarian').value = n; tampilHarian(); } });
$('isiHarian').addEventListener('click', function (e) {
  var s = e.target.closest('[data-hslot]');
  if (s) { bukaModal({ pilihRA: true, tgl: $('tglHarian').value, slot: s.getAttribute('data-hslot') }); return; }
  var ed = e.target.closest('[data-hedit]');
  if (ed) {
    var c = S.catatan.filter(function (x) { return x.id === ed.getAttribute('data-hedit'); })[0];
    if (c) bukaModal({ pilihRA: true, kode: c.kode, editId: c.id });
  }
});

/* ---------- Halaman Cetak ---------- */
function tampilCetak() {
  if (!$('bulanCetak').value) $('bulanCetak').value = hariIni().slice(0, 7);
  var ym = $('bulanCetak').value; if (!ym) return;
  var th = +ym.slice(0, 4), bl = +ym.slice(5, 7) - 1;
  var jmlHari = new Date(th, bl + 1, 0).getDate();
  var perHari = {}, total = 0;
  catatanHidup().forEach(function (c) { if (c.tgl.slice(0, 7) === ym) { perHari[c.tgl] = (perHari[c.tgl] || 0) + 1; total++; } });
  var hariTerisi = Object.keys(perHari).length;
  $('ringkasBulan').innerHTML = '<div><b>' + total + '</b>kegiatan</div><div><b>' + hariTerisi + '</b>hari terisi</div><div><b>' + jmlHari + '</b>sheet di Excel</div>';
  var awal = new Date(th, bl, 1).getDay();
  var html = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(function (h) { return '<div class="kepala">' + h + '</div>'; }).join('');
  for (var k = 0; k < awal; k++) html += '<div class="sel-hari kosong-sel"></div>';
  for (var d = 1; d <= jmlHari; d++) {
    var t = ym + '-' + pad(d), n = perHari[t] || 0, hr = new Date(th, bl, d).getDay();
    html += '<div class="sel-hari' + (n ? ' ada' : '') + (hr === 0 || hr === 6 ? ' libur' : '') + '" data-ketgl="' + t + '"><b>' + d + '</b><span class="n">' + (n ? n + ' keg.' : '') + '</span></div>';
  }
  $('gridHari').innerHTML = html;
  $('infoCetak').textContent = S.profil.nama ? ('Kop: ' + S.profil.nama + ' · NIP ' + (S.profil.nip || '-')) : 'Identitas belum diisi di Pengaturan — kop Excel akan kosong.';
}
$('bulanCetak').addEventListener('change', tampilCetak);
$('gridHari').addEventListener('click', function (e) {
  var s = e.target.closest('[data-ketgl]'); if (!s) return;
  var t = s.getAttribute('data-ketgl'); if (t > hariIni()) return;
  $('tglHarian').value = t; buka('harian');
});

/* ---------- Halaman Pengaturan ---------- */
function isiFormAtur() {
  $('aNama').value = S.profil.nama || ''; $('aNip').value = S.profil.nip || '';
  $('aPangkat').value = S.profil.pangkat || ''; $('aJabatan').value = S.profil.jabatan || '';
  $('aUrl').value = S.koneksi.url || ''; $('aKode').value = S.koneksi.kode || '';
}
function tampilAtur() {
  var aktif = S.master.filter(function (m) { return m.aktif; }).length;
  $('infoMaster').textContent = S.master.length + ' Rencana Aksi (' + aktif + ' aktif). Sumber: ' +
    (S.masterInfo.sumber === 'sheet' ? 'Google Sheet, diperbarui ' + new Date(S.masterInfo.waktu).toLocaleString('id-ID') : 'bawaan aplikasi (Matrik EKIN 2026), belum pernah sinkron');
  $('infoVersi').textContent = 'Logbook Gizi Moncongloe · versi ' + APP_VERSI;
  tampilStatusSinkron();
}
function tampilStatusSinkron() { if (window.isiStatusSinkron) isiStatusSinkron(); }
$('btnSimpanProfil').addEventListener('click', function () {
  S.profil = { nama: $('aNama').value.trim(), nip: $('aNip').value.trim(), pangkat: $('aPangkat').value.trim(), jabatan: $('aJabatan').value.trim(), upd: sekarangISO(), kotor: true };
  simpan.taruh('profil', S.profil);
  beritahu('Identitas tersimpan.');
  if (window.jadwalSinkron) jadwalSinkron();
});

/* ---------- Cadangan ---------- */
function unduhBlob(blob, nama) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
$('btnCadangan').addEventListener('click', function () {
  var data = { aplikasi: 'logbook-gizi-moncongloe', versi: APP_VERSI, dibuat: sekarangISO(), profil: S.profil, master: S.master, catatan: S.catatan };
  unduhBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'cadangan-logbook-gizi-' + hariIni() + '.json');
});
$('btnPulihkan').addEventListener('click', function () { $('filePulihkan').click(); });
$('filePulihkan').addEventListener('change', function () {
  var f = this.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    try {
      var d = JSON.parse(r.result);
      if (d.aplikasi !== 'logbook-gizi-moncongloe' || !Array.isArray(d.catatan)) throw new Error('Bukan file cadangan Logbook Gizi.');
      var n = gabungCatatan(d.catatan, true);
      if (Array.isArray(d.master) && d.master.length && S.masterInfo.sumber !== 'sheet') { S.master = d.master; simpan.taruh('master', S.master); }
      if (d.profil && d.profil.nama && (!S.profil.nama || (d.profil.upd || '') > (S.profil.upd || ''))) { S.profil = d.profil; S.profil.kotor = true; simpan.taruh('profil', S.profil); }
      beritahu('Pulih: ' + n + ' catatan ditambahkan/diperbarui.', 3500);
      segarkan();
      if (window.jadwalSinkron) jadwalSinkron();
    } catch (e) { alert('Gagal memulihkan: ' + e.message); }
  };
  r.readAsText(f);
  this.value = '';
});

/* Gabung catatan dari luar (server / cadangan). Aturan: perubahan paling akhir (upd) yang dipakai. */
function gabungCatatan(daftar, tandaiKotor) {
  var peta = {}, berubah = 0;
  S.catatan.forEach(function (c) { peta[c.id] = c; });
  daftar.forEach(function (r) {
    if (!r || !r.id) return;
    var l = peta[r.id];
    if (!l) {
      var baru = { id: r.id, kode: r.kode, tgl: r.tgl, slot: r.slot, rincian: r.rincian || '', realisasi: r.realisasi || '', link: r.link || '', output: !!r.output, dibuat: r.dibuat || r.upd, upd: r.upd, del: !!r.del, kotor: !!tandaiKotor };
      S.catatan.push(baru); peta[r.id] = baru; berubah++;
    } else if ((r.upd || '') > (l.upd || '')) {
      l.kode = r.kode; l.tgl = r.tgl; l.slot = r.slot; l.rincian = r.rincian || ''; l.realisasi = r.realisasi || ''; l.link = r.link || ''; l.output = !!r.output;
      l.dibuat = l.dibuat || r.dibuat; l.upd = r.upd; l.del = !!r.del; l.kotor = !!tandaiKotor; berubah++;
    }
  });
  if (berubah) simpanCatatan();
  return berubah;
}

/* ---------- Mulai ---------- */
buka('ra');
