// ============================================================
// CONSTANTS & ENUMS
// ============================================================

export const C = {
  STATUS: { AKTIF: 'aktif', SELESAI: 'selesai', KOREKSI: 'koreksi' },
  JENIS: { MASUK: 'masuk', KELUAR: 'keluar' },
  FILTER: { TODAY: 'today', YESTERDAY: 'yesterday', WEEK: 'week', MONTH: 'month', ALL: 'all' },
  TAB: { KIRIM: 'kirim', KAS: 'kas', PRODUKSI: 'produksi', MENU: 'menu' },
  TOAST: { SUCCESS: 'success', ERROR: 'error', WARNING: 'warning', INFO: 'info' }
};

export const FILTER_OPTS = [
  { key: C.FILTER.TODAY, label: 'Hari Ini' },
  { key: C.FILTER.YESTERDAY, label: 'Kemarin' },
  { key: C.FILTER.WEEK, label: '7 Hari' },
  { key: C.FILTER.MONTH, label: 'Bulan Ini' },
  { key: C.FILTER.ALL, label: 'Semua' }
];

export const TABS = [
  { key: C.TAB.KIRIM, label: 'Kirim', icon: 'fas fa-paper-plane' },
  { key: C.TAB.KAS, label: 'Kas', icon: 'fas fa-coins' },
  { key: C.TAB.PRODUKSI, label: 'Produksi', icon: 'fas fa-industry' },
  { key: C.TAB.MENU, label: 'Menu', icon: 'fas fa-bars' }
];

export const SEED_TEMPLATE = {
  pelanggan: [
    { id: 1, nama: 'Toko Makmur', hp: '08123456789', alamat: 'Jl. Raya No.1', saldo: 50000 },
    { id: 2, nama: 'Warung Sari', hp: '08234567890', alamat: 'Jl. Melati No.5', saldo: 0 }
  ],
  barang: [
    { id: 1, nama: 'Tempe 230gr', kategori: 'produk', satuan: 'pcs', stok: 200, harga_jual: 3000, harga_beli: 2000, stok_minimum: 10, aktif: true },
    { id: 2, nama: 'Tempe 500gr', kategori: 'produk', satuan: 'pcs', stok: 150, harga_jual: 5000, harga_beli: 3500, stok_minimum: 10, aktif: true }
  ],
  konsinyasi: [
    { id: 1, nomor: 'KSN-001', tgl: '2026-07-10', pelanggan_id: 1, metode: 'konsinyasi', total_tagihan: 150000, total_bayar: 50000, sisa_piutang: 100000, status: 'aktif', catatan: '', details: [{ barang_id: 1, kirim: 50, laku: 30, retur: 0, harga_jual: 3000, subtotal: 90000 }, { barang_id: 2, kirim: 20, laku: 12, retur: 0, harga_jual: 5000, subtotal: 60000 }] },
    { id: 2, nomor: 'KSN-002', tgl: '2026-07-12', pelanggan_id: 1, metode: 'konsinyasi', total_tagihan: 80000, total_bayar: 80000, sisa_piutang: 0, status: 'selesai', catatan: '', details: [{ barang_id: 2, kirim: 16, laku: 16, retur: 0, harga_jual: 5000, subtotal: 80000 }] }
  ],
  kas: [{ id: 1, tgl: '2026-07-10', jenis: 'masuk', kategori: 'pembayaran', nominal: 50000, ket: 'Pembayaran KSN-001', ref_tabel: 'pembayaran', ref_id: 1 }],
  pembayaran: [{ id: 1, tgl: '2026-07-10', pelanggan_id: 1, nominal: 50000, ket: 'Cicilan KSN-001', details: [{ konsinyasi_id: 1, nominal: 50000 }] }],
  produksi: [{ id: 1, tgl: '2026-07-09', catatan: 'Produksi tempe 230gr 100 pcs' }],
  stok_log: [{ id: 1, tgl: '2026-07-10', barang_id: 1, jenis: 'keluar', qty: 50, stok_awal: 200, stok_akhir: 150, ref_tabel: 'konsinyasi', ref_id: 1, ket: 'Kirim KSN-001' }],
  saldo_log: [{ id: 1, tgl: '2026-07-10', pelanggan_id: 1, jenis: 'keluar', nominal: 50000, saldo_awal: 100000, saldo_akhir: 50000, ref_tabel: 'pembayaran', ref_id: 1, ket: 'Pembayaran KSN-001' }]
};
