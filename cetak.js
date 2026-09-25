/* Pembuat Excel Logbook Kinerja Harian: satu file per bulan, satu sheet per tanggal.
 * Format mengikuti "Format Logbook Harian" UPTD Puskesmas Moncongloe (shift pagi).
 */
'use strict';

function muatExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  return new Promise(function (ok, gagal) {
    var s = document.createElement('script'); s.src = 'exceljs.min.js';
    s.onload = function () { ok(); }; s.onerror = function () { gagal(new Error('Pustaka Excel gagal dimuat. Buka aplikasi sekali saat online.')); };
    document.head.appendChild(s);
  });
}

var GARIS = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
var KUNING = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
var FONT = { name: 'Calibri', size: 11 };
function font(tambahan) { var f = { name: FONT.name, size: FONT.size }; for (var k in tambahan) f[k] = tambahan[k]; return f; }

/* perkiraan tinggi baris agar teks terbungkus tidak terpotong */
function perkiraanBaris(teks, lebarKolom) {
  if (!teks) return 1;
  var perBaris = Math.max(8, Math.floor(lebarKolom * 1.15));
  return String(teks).split('\n').reduce(function (n, b) { return n + Math.max(1, Math.ceil(b.length / perBaris)); }, 0);
}

function gabungIsi(daftar, fn) {
  if (daftar.length === 1) return fn(daftar[0]) || '';
  return daftar.map(function (c, i) { return (i + 1) + '. ' + (fn(c) || '-'); }).join('\n');
}

function isiSheetHari(ws, tgl, catatanHari, profil) {
  var LEBAR = { A: 5.7, B: 13, C: 40, D: 18, E: 42 };
  ws.columns = [{ width: LEBAR.A }, { width: LEBAR.B }, { width: LEBAR.C }, { width: LEBAR.D }, { width: LEBAR.E }];
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.5, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }, horizontalCentered: true };

  ws.mergeCells('A1:E1'); ws.getCell('A1').value = 'LOGBOOK KINERJA HARIAN';
  ws.mergeCells('A2:E2'); ws.getCell('A2').value = 'UPTD PUSKESMAS MONCONGLOE';
  ['A1', 'A2'].forEach(function (a) { ws.getCell(a).font = font({ bold: true, size: 13 }); ws.getCell(a).alignment = { horizontal: 'center', vertical: 'middle' }; });

  var identitas = [['Nama', profil.nama], ['NIP', profil.nip], ['Pangkat/Gol', profil.pangkat], ['Jabatan', profil.jabatan]];
  identitas.forEach(function (p, i) {
    var r = 4 + i;
    ws.mergeCells('A' + r + ':B' + r);
    ws.getCell('A' + r).value = p[0];
    ws.getCell('C' + r).value = ': ' + (p[1] || '');
    ws.getCell('A' + r).font = font(); ws.getCell('C' + r).font = font();
  });
  ws.mergeCells('A9:B9');
  ws.getCell('A9').value = 'Hari/Tanggal'; ws.getCell('A9').font = font();
  ws.getCell('C9').value = ': ' + tglPanjang(tgl); ws.getCell('C9').font = font();

  var H = 11;
  ['NO', 'JAM', 'RENCANA AKSI', 'REALISASI', 'LINK BUKTI DOKUMENTASI KEGIATAN'].forEach(function (t, i) {
    var c = ws.getRow(H).getCell(i + 1);
    c.value = t; c.font = font({ bold: true }); c.border = GARIS;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(H).height = 30;

  var adaIsi = catatanHari.length > 0;
  SUSUNAN_HARI.forEach(function (b, i) {
    var r = H + 1 + i, row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = b.jam;
    for (var k = 1; k <= 5; k++) {
      var c = row.getCell(k);
      c.border = GARIS; c.font = font();
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: k <= 2 ? 'center' : 'left' };
    }
    var tinggiBaris = 1;
    if (b.tetap) {
      if (adaIsi) {
        if (b.penuh) { ws.mergeCells('C' + r + ':E' + r); }
        else { ws.mergeCells('C' + r + ':D' + r); }
        var ct = row.getCell(3);
        ct.value = b.tetap; ct.fill = KUNING;
        ct.font = font({ bold: !!b.penuh });
        ct.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    } else {
      var isi = catatanHari.filter(function (c) { return c.slot === b.jam; });
      if (isi.length) {
        var tRincian = gabungIsi(isi, function (c) { return c.rincian; });
        var tReal = gabungIsi(isi, function (c) { return c.realisasi; });
        var adaLink = isi.some(function (c) { return c.link; });
        row.getCell(3).value = tRincian;
        row.getCell(4).value = isi.some(function (c) { return c.realisasi; }) ? tReal : '';
        if (adaLink) {
          if (isi.length === 1) {
            row.getCell(5).value = { text: isi[0].link, hyperlink: isi[0].link };
            row.getCell(5).font = font({ color: { argb: 'FF0563C1' }, underline: true });
          } else {
            row.getCell(5).value = gabungIsi(isi, function (c) { return c.link; });
          }
        }
        tinggiBaris = Math.max(perkiraanBaris(tRincian, LEBAR.C), perkiraanBaris(tReal, LEBAR.D),
          perkiraanBaris(adaLink ? gabungIsi(isi, function (c) { return c.link; }) : '', LEBAR.E * 0.9));
      }
    }
    row.height = Math.max(28.5, tinggiBaris * 15 + 6);
  });

  var T = H + SUSUNAN_HARI.length + 3; // baris tanda tangan
  ws.getCell('B' + T).value = 'Yang Membuat Laporan';
  ws.getCell('E' + T).value = 'Yang Menyetujui,';
  ws.getCell('E' + (T + 1)).value = 'Kepala Ruangan …………………………';
  ws.getCell('B' + (T + 5)).value = profil.nama || '…………………………………';
  ws.getCell('B' + (T + 5)).font = font({ bold: !!profil.nama, underline: !!profil.nama });
  ws.getCell('B' + (T + 6)).value = 'NIP. ' + (profil.nip || '');
  ws.getCell('E' + (T + 5)).value = '…………………………………';
  ws.getCell('E' + (T + 6)).value = 'NIP. ';
  [T, T + 1, T + 6].forEach(function (r) { ['B', 'E'].forEach(function (c) { if (!ws.getCell(c + r).font || !ws.getCell(c + r).font.bold) ws.getCell(c + r).font = font(); }); });
  ws.getCell('E' + (T + 5)).font = font();
  ws.pageSetup.printArea = 'A1:E' + (T + 7);
}

function buatExcelBulan(ym) {
  return muatExcelJS().then(function () {
    var th = +ym.slice(0, 4), bl = +ym.slice(5, 7) - 1;
    var jmlHari = new Date(th, bl + 1, 0).getDate();
    var wb = new ExcelJS.Workbook();
    wb.creator = 'Logbook Gizi Moncongloe';
    wb.created = new Date();
    var hidup = catatanHidup();
    for (var d = 1; d <= jmlHari; d++) {
      var tgl = ym + '-' + pad(d);
      var namaSheet = pad(d) + ' ' + NAMA_HARI[new Date(th, bl, d).getDay()].slice(0, 3);
      var ws = wb.addWorksheet(namaSheet, { views: [{ showGridLines: false }] });
      var hariIniCat = hidup.filter(function (c) { return c.tgl === tgl; }).sort(urutHarian);
      isiSheetHari(ws, tgl, hariIniCat, S.profil);
    }
    return wb.xlsx.writeBuffer().then(function (buf) {
      var nama = (S.profil.nama || 'Petugas').split(',')[0].trim().replace(/[^A-Za-z0-9]+/g, '_');
      return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        nama: 'Logbook_Harian_' + nama + '_' + NAMA_BULAN[bl] + '_' + th + '.xlsx' };
    });
  });
}

$('btnUnduhExcel').addEventListener('click', function () {
  var ym = $('bulanCetak').value, tombol = this;
  if (!ym) { beritahu('Pilih bulan terlebih dahulu.'); return; }
  if (!S.profil.nama && !confirm('Identitas petugas belum diisi, kop Excel akan kosong. Tetap lanjut?')) return;
  tombol.disabled = true; tombol.textContent = 'Menyiapkan…';
  var dulu = (sinkronAktif() && navigator.onLine) ? sinkronSekarang() : Promise.resolve();
  dulu.then(function () { tampilCetak(); return buatExcelBulan(ym); })
    .then(function (h) { unduhBlob(h.blob, h.nama); beritahu('Excel dibuat: ' + h.nama, 3500); })
    .catch(function (e) { alert('Gagal membuat Excel: ' + e.message); })
    .then(function () { tombol.disabled = false; tombol.textContent = '⬇ Unduh Excel bulan ini'; });
});
