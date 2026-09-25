/* Capaian Matrik EKIN: menerjemahkan catatan harian menjadi realisasi per RA per bulan,
 * plus Excel "Matrik Realisasi EKIN" (sheet matrik + sheet Ringkasan e-Kinerja).
 */
'use strict';

var BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
var STATUS = {
  ok: { simbol: '✓', ket: 'output selesai', warna: 'FFC8E6C9', teks: 'FF1B5E20' },
  tambah: { simbol: '+', ket: 'output di luar jadwal', warna: 'FFBBDEFB', teks: 'FF0D47A1' },
  proses: { simbol: '…', ket: 'ada kegiatan, output belum selesai', warna: 'FFFFF3B0', teks: 'FF7A5A00' },
  gagal: { simbol: '✗', ket: 'terjadwal, tidak ada kegiatan', warna: 'FFFFCDD2', teks: 'FFB71C1C' },
  rencana: { simbol: '○', ket: 'terjadwal, bulan belum lewat', warna: 'FFEEF1F5', teks: 'FF6B7280' }
};

/* Hitung capaian untuk satu tahun. */
function hitungCapaian(tahun) {
  var kini = hariIni().slice(0, 7);
  var perRA = {};
  catatanHidup().forEach(function (c) {
    if (c.tgl.slice(0, 4) !== String(tahun)) return;
    var b = +c.tgl.slice(5, 7) - 1;
    var r = perRA[c.kode] || (perRA[c.kode] = []);
    (r[b] || (r[b] = [])).push(c);
  });
  var daftar = S.master.filter(function (m) { return m.aktif || perRA[m.kode]; });
  // RA di catatan yang tidak ada di master (mis. kode dihapus dari Sheet)
  Object.keys(perRA).forEach(function (k) {
    if (!cariRA(k)) daftar.push({ kode: k, no: '-', rhk: '(RA tidak ada di Master)', ra: k, target: '', satuan: '', bulan: [0,0,0,0,0,0,0,0,0,0,0,0], bukti: '', aktif: false });
  });
  return daftar.map(function (m) {
    var bulan = [], realisasi = 0;
    for (var i = 0; i < 12; i++) {
      var cat = ((perRA[m.kode] || [])[i] || []).slice().sort(function (a, b) { return a.tgl < b.tgl ? -1 : a.tgl > b.tgl ? 1 : urutHarian(a, b); });
      var out = cat.filter(function (c) { return c.output; });
      var ym = tahun + '-' + pad(i + 1), st = '';
      if (out.length) st = m.bulan[i] ? 'ok' : 'tambah';
      else if (cat.length) st = 'proses';
      else if (m.bulan[i]) st = ym < kini ? 'gagal' : 'rencana';
      if (out.length) realisasi++;
      bulan.push({ status: st, catatan: cat, output: out });
    }
    var target = parseFloat(String(m.target).replace(',', '.'));
    return { m: m, bulan: bulan, realisasi: realisasi, target: isNaN(target) ? null : target,
      persen: (!isNaN(target) && target > 0) ? Math.round(realisasi / target * 100) : null,
      jumlahKegiatan: bulan.reduce(function (n, b) { return n + b.catatan.length; }, 0) };
  });
}

/* ---------- Tampilan ---------- */
var _pilihCap = null;
function isiPilihanTahun() {
  var sel = $('tahunCapaian'), ada = {}, now = new Date().getFullYear();
  ada[now] = 1;
  catatanHidup().forEach(function (c) { ada[c.tgl.slice(0, 4)] = 1; });
  var th = Object.keys(ada).map(Number).sort(function (a, b) { return b - a; });
  var lama = sel.value || String(now);
  sel.innerHTML = th.map(function (t) { return '<option>' + t + '</option>'; }).join('');
  sel.value = th.indexOf(+lama) >= 0 ? lama : String(now);
}
function tampilCapaian() {
  isiPilihanTahun();
  var tahun = +$('tahunCapaian').value, data = hitungCapaian(tahun);
  var h = '<thead><tr><th>No</th><th>Rencana Aksi</th><th>Target</th>' + BULAN_SINGKAT.map(function (b) { return '<th>' + b + '</th>'; }).join('') + '<th>Real.</th><th>%</th></tr></thead><tbody>';
  if (!data.length) h += '<tr><td colspan="17" class="kosong">Belum ada Rencana Aksi.</td></tr>';
  data.forEach(function (d, i) {
    h += '<tr><td class="tengah">' + (i + 1) + '</td><td class="ra-sel">' + esc(d.m.ra) + '<small>' + esc(d.m.kode) + ' · ' + d.jumlahKegiatan + ' kegiatan</small></td>' +
      '<td class="tengah nowrap">' + esc(d.m.target + ' ' + d.m.satuan) + '</td>' +
      d.bulan.map(function (b, j) {
        var st = STATUS[b.status];
        var dip = _pilihCap && _pilihCap.kode === d.m.kode && _pilihCap.b === j && _pilihCap.th === tahun;
        return '<td class="sel' + (dip ? ' dipilih' : '') + '" data-ck="' + esc(d.m.kode) + '" data-cb="' + j + '">' + (st ? '<i class="st ' + b.status + '">' + st.simbol + '</i>' : '') + '</td>';
      }).join('') +
      '<td class="tengah pct">' + d.realisasi + '</td><td class="tengah pct">' + (d.persen == null ? '-' : d.persen + '%') + '</td></tr>';
  });
  $('tabelCapaian').innerHTML = h + '</tbody>';
  tampilDetailCapaian(data, tahun);
}
function tampilDetailCapaian(data, tahun) {
  var el = $('detailCapaian');
  if (!_pilihCap || _pilihCap.th !== tahun) { el.innerHTML = ''; return; }
  var d = data.filter(function (x) { return x.m.kode === _pilihCap.kode; })[0];
  if (!d) { el.innerHTML = ''; return; }
  var b = d.bulan[_pilihCap.b], st = STATUS[b.status];
  var judul = NAMA_BULAN[_pilihCap.b] + ' ' + tahun + ' · ' + d.m.kode;
  var isi = b.catatan.length ? '<ol>' + b.catatan.map(function (c) {
    return '<li>' + esc(tglSedang(c.tgl)) + ' (' + esc(c.slot) + '): ' + esc(c.rincian) + (c.realisasi ? ' · <b>' + esc(c.realisasi) + '</b>' : '') +
      (c.output ? ' <span class="lencana">Output ✓</span>' : '') + (c.link ? ' · ' + tampilLink(c.link) : '') + '</li>';
  }).join('') + '</ol>' : '<p class="catatan-kecil">Tidak ada kegiatan tercatat di bulan ini.</p>';
  var tombol = (b.status === 'proses' || b.status === 'gagal' || b.status === 'rencana') && d.m.aktif
    ? '<div class="baris-tombol"><button class="btn biru kecil" data-captambah="' + esc(d.m.kode) + '">+ Tambah catatan untuk RA ini</button></div>' : '';
  el.innerHTML = '<div class="detail-cap"><h4>' + esc(judul) + (st ? ' — ' + st.simbol + ' ' + esc(st.ket) : '') + '</h4><div class="catatan-kecil">' + esc(d.m.ra) + '</div>' + isi + tombol + '</div>';
}
$('tahunCapaian').addEventListener('change', function () { _pilihCap = null; tampilCapaian(); });
$('tabelCapaian').addEventListener('click', function (e) {
  var s = e.target.closest('[data-ck]'); if (!s) return;
  _pilihCap = { kode: s.getAttribute('data-ck'), b: +s.getAttribute('data-cb'), th: +$('tahunCapaian').value };
  tampilCapaian();
  $('detailCapaian').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('detailCapaian').addEventListener('click', function (e) {
  var t = e.target.closest('[data-captambah]'); if (t) bukaModal({ kode: t.getAttribute('data-captambah') });
});

/* ---------- Excel Matrik Realisasi ---------- */
function buatExcelMatrik(tahun) {
  return muatExcelJS().then(function () {
    var data = hitungCapaian(tahun);
    var wb = new ExcelJS.Workbook(); wb.creator = 'Logbook Gizi Moncongloe'; wb.created = new Date();
    var G = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    var F = function (x) { var f = { name: 'Calibri', size: 11 }; for (var k in x) f[k] = x[k]; return f; };
    var KUNING = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

    /* ===== Sheet 1: Matrik Realisasi ===== */
    var ws = wb.addWorksheet('Matrik Realisasi', { views: [{ state: 'frozen', ySplit: 7, xSplit: 3, showGridLines: false }] });
    ws.columns = [{ width: 4.5 }, { width: 30 }, { width: 46 }, { width: 12 }]
      .concat(BULAN_SINGKAT.map(function () { return { width: 5.2 }; }))
      .concat([{ width: 10 }, { width: 9 }, { width: 20 }, { width: 44 }]);
    var KOL = 20;
    ws.mergeCells(1, 1, 1, KOL); ws.getCell('A1').value = 'MATRIK REALISASI EKIN ' + tahun;
    ws.getCell('A1').font = F({ bold: true, size: 14 });
    ws.mergeCells(2, 1, 2, KOL); ws.getCell('A2').value = 'UPTD PUSKESMAS MONCONGLOE';
    ws.getCell('A2').font = F({ bold: true });
    ws.getCell('A3').value = 'Nama : ' + (S.profil.nama || '') + '    NIP : ' + (S.profil.nip || '');
    ws.getCell('A4').value = 'Jabatan : ' + (S.profil.jabatan || '') + (S.profil.pangkat ? '    Pangkat/Gol : ' + S.profil.pangkat : '');
    var tglKeadaan = (String(tahun) === hariIni().slice(0, 4)) ? tglSedang(hariIni()) : ('31 Desember ' + tahun);
    ws.getCell('A5').value = 'Keadaan s/d : ' + tglKeadaan;
    [3, 4, 5].forEach(function (r) { ws.getCell('A' + r).font = F(); });

    var H = 7;
    var kepala = ['No', 'RENCANA HASIL KERJA (RHK)', 'RENCANA AKSI', 'Target'].concat(BULAN_SINGKAT).concat(['Realisasi', 'Capaian', 'Bukti Dukung (rencana)', 'Bukti Dukung (link output)']);
    kepala.forEach(function (t, i) {
      var c = ws.getRow(H).getCell(i + 1);
      c.value = t; c.font = F({ bold: true }); c.fill = KUNING; c.border = G;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(H).height = 32;

    var r = H + 1, awalGrup = r, rhkLalu = null, noLalu = null;
    function tutupGrup(akhir) {
      if (akhir > awalGrup) { ws.mergeCells(awalGrup, 1, akhir, 1); ws.mergeCells(awalGrup, 2, akhir, 2); }
    }
    data.forEach(function (d) {
      var m = d.m;
      if (rhkLalu !== null && (m.rhk !== rhkLalu || m.no !== noLalu)) { tutupGrup(r - 1); awalGrup = r; }
      var row = ws.getRow(r);
      row.getCell(1).value = m.no; row.getCell(2).value = m.rhk; row.getCell(3).value = m.ra + (m.aktif ? '' : ' (nonaktif)');
      row.getCell(4).value = (m.target + ' ' + m.satuan).trim();
      d.bulan.forEach(function (b, j) {
        var c = row.getCell(5 + j), st = STATUS[b.status];
        if (st) { c.value = st.simbol; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.warna } }; c.font = F({ bold: true, color: { argb: st.teks } }); }
      });
      row.getCell(17).value = d.realisasi;
      row.getCell(18).value = d.persen == null ? '-' : d.persen / 100;
      if (d.persen != null) row.getCell(18).numFmt = '0%';
      row.getCell(19).value = m.bukti || '';
      var link = [];
      d.bulan.forEach(function (b, j) { b.output.forEach(function (c) { if (c.link) link.push(BULAN_SINGKAT[j] + ': ' + c.link); }); });
      row.getCell(20).value = link.join('\n');
      for (var k = 1; k <= KOL; k++) {
        var c = row.getCell(k);
        c.border = G;
        if (!c.font || k < 5 || k > 16) c.font = F(k === 17 || k === 18 ? { bold: true } : {});
        c.alignment = { vertical: 'middle', wrapText: true, horizontal: (k === 1 || (k >= 4 && k <= 18)) ? 'center' : 'left' };
      }
      var baris = Math.max(Math.ceil(m.ra.length / 48), Math.ceil(m.rhk.length / 32), link.length, 1);
      row.height = Math.max(22, baris * 15 + 5);
      rhkLalu = m.rhk; noLalu = m.no; r++;
    });
    if (data.length) tutupGrup(r - 1);

    r += 1;
    ws.getCell('B' + r).value = 'Keterangan:'; ws.getCell('B' + r).font = F({ bold: true });
    Object.keys(STATUS).forEach(function (k, i) {
      var st = STATUS[k], rr = r + 1 + i, c = ws.getCell('B' + rr);
      c.value = st.simbol + '  ' + st.ket; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.warna } }; c.font = F({ color: { argb: st.teks } });
    });
    ws.getCell('B' + (r + 7)).value = 'Realisasi = jumlah bulan dengan output yang ditandai selesai di Logbook Harian. Capaian = Realisasi ÷ Target.';
    ws.getCell('B' + (r + 7)).font = F({ italic: true, size: 10 });
    ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } };

    /* ===== Sheet 2: Ringkasan e-Kinerja ===== */
    var w2 = wb.addWorksheet('Ringkasan e-Kinerja', { views: [{ state: 'frozen', ySplit: 3 }] });
    w2.columns = [{ width: 5 }, { width: 10 }, { width: 8 }, { width: 40 }, { width: 18 }, { width: 50 }, { width: 16 }, { width: 44 }, { width: 9 }];
    w2.mergeCells('A1:I1'); w2.getCell('A1').value = 'RINGKASAN CATATAN HARIAN UNTUK INPUT e-KINERJA · ' + tahun + (S.profil.nama ? ' · ' + S.profil.nama : '');
    w2.getCell('A1').font = F({ bold: true, size: 13 });
    w2.getCell('A2').value = 'Urut per Rencana Aksi lalu tanggal. Pakai filter pada kolom Bulan / Kode RA untuk menampilkan yang diperlukan.';
    w2.getCell('A2').font = F({ italic: true, size: 10 });
    var k2 = ['No', 'Bulan', 'Kode RA', 'Rencana Aksi', 'Tanggal', 'Rincian Kegiatan Harian', 'Realisasi', 'Tautan Dokumen Pendukung', 'Output'];
    k2.forEach(function (t, i) {
      var c = w2.getRow(3).getCell(i + 1); c.value = t; c.font = F({ bold: true });
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE9F6' } }; c.border = G; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    var n = 0, rr = 4, warnaGrup = false, kodeLalu = null;
    data.forEach(function (d) {
      d.bulan.forEach(function (b, j) {
        b.catatan.forEach(function (c) {
          if (d.m.kode !== kodeLalu) { warnaGrup = !warnaGrup; kodeLalu = d.m.kode; }
          n++;
          var row = w2.getRow(rr++);
          var nilai = [n, NAMA_BULAN[j], d.m.kode, d.m.ra, tglSedang(c.tgl), c.rincian, c.realisasi || '', c.link || '', c.output ? 'Ya' : ''];
          nilai.forEach(function (v, i) {
            var cel = row.getCell(i + 1); cel.value = v; cel.border = G; cel.font = F();
            cel.alignment = { vertical: 'top', wrapText: true, horizontal: (i === 0 || i === 2 || i === 8) ? 'center' : 'left' };
            if (warnaGrup) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FB' } };
          });
          if (c.link) { row.getCell(8).value = { text: c.link, hyperlink: c.link }; row.getCell(8).font = F({ color: { argb: 'FF0563C1' }, underline: true }); }
          row.height = Math.max(18, Math.max(Math.ceil(c.rincian.length / 55), Math.ceil(d.m.ra.length / 44), 1) * 15 + 3);
        });
      });
    });
    if (!n) { w2.getCell('A4').value = 'Belum ada catatan harian di tahun ' + tahun + '.'; }
    else w2.autoFilter = { from: { row: 3, column: 1 }, to: { row: rr - 1, column: 9 } };
    w2.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    return wb.xlsx.writeBuffer().then(function (buf) {
      var nama = (S.profil.nama || 'Petugas').split(',')[0].trim().replace(/[^A-Za-z0-9]+/g, '_');
      return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        nama: 'Matrik_Realisasi_EKIN_' + tahun + '_' + nama + '.xlsx' };
    });
  });
}

$('btnUnduhMatrik').addEventListener('click', function () {
  var tahun = +$('tahunCapaian').value, tombol = this;
  tombol.disabled = true; tombol.textContent = 'Menyiapkan…';
  var dulu = (sinkronAktif() && navigator.onLine) ? sinkronSekarang() : Promise.resolve();
  dulu.then(function () { tampilCapaian(); return buatExcelMatrik(tahun); })
    .then(function (h) { unduhBlob(h.blob, h.nama); beritahu('Excel dibuat: ' + h.nama, 3500); })
    .catch(function (e) { alert('Gagal membuat Excel: ' + e.message); })
    .then(function () { tombol.disabled = false; tombol.textContent = '⬇ Unduh Matrik Realisasi (Excel)'; });
});
