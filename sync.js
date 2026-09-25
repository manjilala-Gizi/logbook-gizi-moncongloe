/* Sinkron ke Google Sheet lewat Apps Script Web App.
 * Satu permintaan "sinkron": kirim catatan yang belum terkirim + identitas,
 * lalu terima semua catatan, master RA, dan identitas dari Sheet.
 */
'use strict';

var _sedangSinkron = false, _tmrSinkron = null;

function sinkronAktif() { return !!(S.koneksi.url && S.koneksi.kode); }
function jumlahAntre() { return S.catatan.filter(function (c) { return c.kotor; }).length + (S.profil.kotor ? 1 : 0); }

function panggilServer(url, kode, isi) {
  var ctrl = window.AbortController ? new AbortController() : null;
  var tmr = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
  isi.kode = kode;
  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(isi),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    signal: ctrl ? ctrl.signal : undefined
  }).then(function (r) { return r.text(); }, function () {
    throw new Error('Tidak bisa menghubungi server (sinyal lemah atau tidak ada).');
  }).then(function (t) {
    clearTimeout(tmr);
    var j;
    try { j = JSON.parse(t); } catch (e) { throw new Error('Jawaban server tidak dikenali. Periksa URL (harus berakhiran /exec) dan akses Web App "Siapa saja".'); }
    if (!j.ok) throw new Error(j.galat || 'Server menolak permintaan.');
    return j;
  }, function (e) { clearTimeout(tmr); throw e; });
}

function sinkronSekarang(opsi) {
  opsi = opsi || {};
  if (_sedangSinkron) return Promise.resolve(false);
  if (!sinkronAktif()) return Promise.resolve(false);
  if (!navigator.onLine) { perbaruiBadge(); return Promise.resolve(false); }
  _sedangSinkron = true; perbaruiBadge();

  var kirim = S.catatan.filter(function (c) { return c.kotor; }).map(function (c) {
    var m = cariRA(c.kode);
    return { id: c.id, kode: c.kode, ra: m ? m.ra : '', tgl: c.tgl, slot: c.slot, rincian: c.rincian, realisasi: c.realisasi, link: c.link, dibuat: c.dibuat, upd: c.upd, del: c.del };
  });
  var cap = {}; kirim.forEach(function (c) { cap[c.id] = c.upd; });
  var profilKirim = S.profil.kotor ? { nama: S.profil.nama, nip: S.profil.nip, pangkat: S.profil.pangkat, jabatan: S.profil.jabatan, upd: S.profil.upd } : null;

  return panggilServer(S.koneksi.url, S.koneksi.kode, { aksi: 'sinkron', catatan: kirim, profil: profilKirim, versiApp: APP_VERSI })
    .then(function (j) {
      // tandai yang terkirim (bila belum diubah lagi selama proses)
      S.catatan.forEach(function (c) { if (c.kotor && cap[c.id] && cap[c.id] === c.upd) c.kotor = false; });
      if (profilKirim && S.profil.upd === profilKirim.upd) S.profil.kotor = false;
      // terima dari Sheet
      if (Array.isArray(j.catatan)) gabungCatatan(j.catatan, false);
      if (Array.isArray(j.master) && j.master.length) {
        S.master = j.master; simpan.taruh('master', S.master);
        S.masterInfo = { sumber: 'sheet', waktu: sekarangISO() }; simpan.taruh('masterInfo', S.masterInfo);
      }
      if (j.profil && j.profil.nama && !S.profil.kotor && (j.profil.upd || '') > (S.profil.upd || '')) {
        S.profil = { nama: j.profil.nama, nip: j.profil.nip, pangkat: j.profil.pangkat, jabatan: j.profil.jabatan, upd: j.profil.upd, kotor: false };
        if (halAktif === 'atur') { $('aNama').value = S.profil.nama; $('aNip').value = S.profil.nip; $('aPangkat').value = S.profil.pangkat; $('aJabatan').value = S.profil.jabatan; }
      }
      simpan.taruh('profil', S.profil);
      simpanCatatan();
      S.sinkron = { terakhir: sekarangISO(), galat: '', namaSheet: j.namaSheet || S.sinkron.namaSheet || '' };
      simpan.taruh('sinkron', S.sinkron);
      return true;
    })
    .catch(function (e) {
      S.sinkron.galat = e.message; simpan.taruh('sinkron', S.sinkron);
      if (opsi.lempar) throw e;
      return false;
    })
    .then(function (hasil) { _sedangSinkron = false; segarkan(); return hasil; },
          function (e) { _sedangSinkron = false; segarkan(); throw e; });
}

function jadwalSinkron() {
  perbaruiBadge();
  clearTimeout(_tmrSinkron);
  _tmrSinkron = setTimeout(function () { sinkronSekarang(); }, 1500);
}

function perbaruiBadge() {
  var b = $('badge'), n = jumlahAntre();
  b.className = '';
  if (!sinkronAktif()) {
    if (n && S.catatan.length) { b.textContent = 'Sinkron belum aktif'; b.style.display = 'inline-block'; }
    else b.style.display = 'none';
    return;
  }
  if (_sedangSinkron) { b.textContent = 'Menyinkronkan…'; b.style.display = 'inline-block'; return; }
  if (!navigator.onLine) { b.textContent = 'Offline' + (n ? ' · ' + n + ' antre' : ''); b.className = n ? 'antre' : ''; b.style.display = 'inline-block'; return; }
  if (S.sinkron.galat && n) { b.textContent = 'Gagal sinkron'; b.className = 'gagal'; b.style.display = 'inline-block'; return; }
  if (n) { b.textContent = n + ' belum terkirim'; b.className = 'antre'; b.style.display = 'inline-block'; return; }
  b.style.display = 'none';
}

function isiStatusSinkron() {
  var el = $('statusSinkron'), n = jumlahAntre();
  el.className = 'status-sinkron';
  if (!sinkronAktif()) { el.textContent = 'Sinkron belum aktif. Data hanya tersimpan di perangkat ini (' + catatanHidup().length + ' catatan).'; return; }
  var t = [];
  if (S.sinkron.namaSheet) t.push('Terhubung ke: ' + S.sinkron.namaSheet);
  t.push('Sinkron terakhir: ' + (S.sinkron.terakhir ? new Date(S.sinkron.terakhir).toLocaleString('id-ID') : 'belum pernah'));
  t.push(n ? n + ' perubahan menunggu dikirim' : 'Semua data sudah terkirim');
  if (S.sinkron.galat) { t.push('Kesalahan terakhir: ' + S.sinkron.galat); el.className += ' gagal'; }
  else if (S.sinkron.terakhir) el.className += ' ok';
  el.innerHTML = t.map(esc).join('<br>');
}

$('badge').addEventListener('click', function () { buka('atur'); });

$('btnUji').addEventListener('click', function () {
  var url = $('aUrl').value.trim(), kode = $('aKode').value.trim(), tombol = this;
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { alert('Alamat Web App harus diawali https://script.google.com/ dan berakhiran /exec'); return; }
  if (!kode) { alert('Kode akses belum diisi.'); return; }
  tombol.disabled = true; tombol.textContent = 'Menguji…';
  panggilServer(url, kode, { aksi: 'uji' }).then(function (j) {
    S.koneksi = { url: url, kode: kode }; simpan.taruh('koneksi', S.koneksi);
    S.sinkron.namaSheet = j.namaSheet || ''; S.sinkron.galat = ''; simpan.taruh('sinkron', S.sinkron);
    beritahu('Terhubung ke ' + (j.namaSheet || 'Google Sheet') + '. Menyinkronkan…', 3500);
    return sinkronSekarang();
  }).catch(function (e) { alert('Gagal: ' + e.message); })
    .then(function () { tombol.disabled = false; tombol.textContent = 'Uji & aktifkan'; segarkan(); });
});
$('btnSinkron').addEventListener('click', function () {
  if (!sinkronAktif()) { alert('Isi alamat Web App dan kode akses, lalu tekan "Uji & aktifkan".'); return; }
  if (!navigator.onLine) { alert('Perangkat sedang offline.'); return; }
  sinkronSekarang().then(function (ok) { beritahu(ok ? 'Sinkron selesai.' : 'Sinkron gagal: ' + (S.sinkron.galat || '')); });
});

window.addEventListener('online', function () { perbaruiBadge(); sinkronSekarang(); });
window.addEventListener('offline', perbaruiBadge);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sinkronSekarang(); });
setInterval(function () { sinkronSekarang(); }, 5 * 60 * 1000);
perbaruiBadge();
sinkronSekarang();
