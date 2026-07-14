// ============================================================
// PIPELINE - Business Logic (Reusable, Pure Functions)
// ============================================================

import { C } from './constants.js';
import { todayStr, makeId, sum } from './utils.js';

// ===== Context State (DI akan di-inject dari main) =====
export const ContextInventory = { state: { barang: [], stok_log: [] } };
export const ContextSales = { state: { pelanggan: [], konsinyasi: [], pembayaran: [] } };
export const ContextFinance = { state: { kas: [], saldo_log: [] } };

// ===== Helper: Inject data ke context =====
export function injectContext(data) {
  ContextInventory.state.barang = data.barang || [];
  ContextInventory.state.stok_log = data.stok_log || [];
  ContextSales.state.pelanggan = data.pelanggan || [];
  ContextSales.state.konsinyasi = data.konsinyasi || [];
  ContextSales.state.pembayaran = data.pembayaran || [];
  ContextFinance.state.kas = data.kas || [];
  ContextFinance.state.saldo_log = data.saldo_log || [];
}

// ===== 1. Process Returns =====
function processReturns(payload) {
  const { returMap } = payload;
  const { konsinyasi, barang, stok_log } = ContextInventory.state;
  const { konsinyasi: salesKonsinyasi } = ContextSales.state;

  for (const [ksId, returQty] of Object.entries(returMap)) {
    if (!returQty) continue;
    const ks = salesKonsinyasi.find(k => k.id === Number(ksId));
    if (!ks) throw new Error('Konsinyasi tidak ditemukan');

    let totalKirim = ks.details.reduce((a, d) => a + d.kirim, 0);
    if (!totalKirim) throw new Error('Total kirim 0');

    let sisa = returQty;
    for (const d of ks.details) {
      const bagian = Math.round((d.kirim / totalKirim) * returQty);
      const actual = Math.min(bagian, d.kirim - d.retur);
      d.retur += actual;
      sisa -= actual;
    }
    if (sisa > 0 && ks.details.length) ks.details[0].retur += sisa;

    for (const d of ks.details) {
      d.laku = Math.max(d.kirim - d.retur, 0);
      d.subtotal = d.laku * d.harga_jual;
      // Restock
      const br = barang.find(b => b.id === d.barang_id);
      if (br) {
        const old = br.stok;
        br.stok += d.retur;
        stok_log.push({
          id: Date.now() + Math.random(),
          tgl: todayStr(),
          barang_id: br.id,
          jenis: C.JENIS.MASUK,
          qty: d.retur,
          stok_awal: old,
          stok_akhir: br.stok,
          ref_tabel: 'konsinyasi',
          ref_id: ks.id,
          ket: `Retur ${ks.nomor}`
        });
      }
    }
    ks.total_tagihan = ks.details.reduce((a, d) => a + d.subtotal, 0);
    ks.sisa_piutang = Math.max(ks.total_tagihan - ks.total_bayar, 0);
    if (ks.sisa_piutang === 0) ks.status = C.STATUS.SELESAI;
  }
  return payload;
}

// ===== 2. Create New Consignment =====
function createNewConsignment(payload) {
  const { pelangganId, items } = payload;
  const { barang, stok_log } = ContextInventory.state;
  const { konsinyasi } = ContextSales.state;

  const filtered = items.filter(i => i.barang_id && i.qty > 0);
  if (!filtered.length) return payload;

  const newKsn = {
    id: Date.now(),
    nomor: makeId(),
    tgl: todayStr(),
    pelanggan_id: pelangganId,
    metode: 'konsinyasi',
    total_tagihan: 0,
    total_bayar: 0,
    sisa_piutang: 0,
    status: C.STATUS.AKTIF,
    catatan: '',
    details: []
  };

  newKsn.details = filtered.map(item => {
    const br = barang.find(b => b.id === item.barang_id);
    if (!br) throw new Error('Barang tidak ditemukan');
    if (br.stok < item.qty) throw new Error(`Stok ${br.nama} tidak cukup`);

    const subtotal = item.qty * br.harga_jual;
    const old = br.stok;
    br.stok -= item.qty;

    stok_log.push({
      id: Date.now() + Math.random(),
      tgl: todayStr(),
      barang_id: br.id,
      jenis: C.JENIS.KELUAR,
      qty: item.qty,
      stok_awal: old,
      stok_akhir: br.stok,
      ref_tabel: 'konsinyasi',
      ref_id: newKsn.id,
      ket: `Kirim ${newKsn.nomor}`
    });

    return {
      barang_id: br.id,
      kirim: item.qty,
      laku: item.qty,
      retur: 0,
      harga_jual: br.harga_jual,
      subtotal
    };
  });

  newKsn.total_tagihan = newKsn.details.reduce((a, d) => a + d.subtotal, 0);
  newKsn.sisa_piutang = newKsn.total_tagihan;
  konsinyasi.push(newKsn);

  return { ...payload, newConsignment: newKsn };
}

// ===== 3. Process Payment =====
function processPayment(payload) {
  const { pelangganId, bayar, gunakanSaldo, bayarSekarang, simpanSaldo, totalTagihan, newConsignment } = payload;
  const { pelanggan, konsinyasi } = ContextSales.state;
  const { kas, saldo_log } = ContextFinance.state;

  let totalBayar = bayar || 0;
  let saldoDigunakan = 0;
  const pel = pelanggan.find(c => c.id === pelangganId);

  if (gunakanSaldo && pel) {
    saldoDigunakan = Math.min(pel.saldo, totalTagihan);
    totalBayar += saldoDigunakan;
    pel.saldo -= saldoDigunakan;
    saldo_log.push({
      id: Date.now() + Math.random(),
      tgl: todayStr(),
      pelanggan_id: pel.id,
      jenis: C.JENIS.KELUAR,
      nominal: saldoDigunakan,
      saldo_awal: pel.saldo + saldoDigunakan,
      saldo_akhir: pel.saldo,
      ref_tabel: 'pembayaran',
      ref_id: Date.now(),
      ket: 'Gunakan saldo'
    });
  }

  let kelebihan = 0;
  if (totalBayar > totalTagihan) {
    kelebihan = totalBayar - totalTagihan;
    totalBayar = totalTagihan;
  }

  const targets = [
    ...(bayarSekarang && newConsignment ? [newConsignment] : []),
    ...konsinyasi.filter(k =>
      k.pelanggan_id === pelangganId &&
      k.sisa_piutang > 0 &&
      k.id !== newConsignment?.id
    )
  ].sort((a, b) => a.id - b.id);

  if (totalBayar > 0 && targets.length) {
    let sisa = totalBayar;
    const payment = {
      id: Date.now(),
      tgl: todayStr(),
      pelanggan_id: pelangganId,
      nominal: totalBayar,
      ket: 'Pembayaran konsinyasi',
      details: []
    };

    for (const ks of targets) {
      if (sisa <= 0) break;
      const alokasi = Math.min(sisa, ks.sisa_piutang);
      if (alokasi > 0) {
        payment.details.push({ konsinyasi_id: ks.id, nominal: alokasi });
        ks.total_bayar += alokasi;
        ks.sisa_piutang = Math.max(ks.total_tagihan - ks.total_bayar, 0);
        if (ks.sisa_piutang === 0) ks.status = C.STATUS.SELESAI;
        sisa -= alokasi;
      }
    }

    if (payment.details.length) {
      const { pembayaran } = ContextSales.state;
      pembayaran.push(payment);
      kas.push({
        id: Date.now(),
        tgl: todayStr(),
        jenis: C.JENIS.MASUK,
        kategori: 'pembayaran',
        nominal: totalBayar,
        ket: `Pembayaran dari ${pel?.nama}`,
        ref_tabel: 'pembayaran',
        ref_id: payment.id
      });
    }
  }

  // Handle kelebihan
  if (kelebihan > 0) {
    if (simpanSaldo && pel) {
      const old = pel.saldo;
      pel.saldo += kelebihan;
      saldo_log.push({
        id: Date.now() + Math.random(),
        tgl: todayStr(),
        pelanggan_id: pel.id,
        jenis: C.JENIS.MASUK,
        nominal: kelebihan,
        saldo_awal: old,
        saldo_akhir: pel.saldo,
        ref_tabel: 'pembayaran',
        ref_id: Date.now(),
        ket: 'Simpan kelebihan saldo'
      });
    } else if (pel) {
      kas.push({
        id: Date.now(),
        tgl: todayStr(),
        jenis: C.JENIS.KELUAR,
        kategori: 'kembalian',
        nominal: kelebihan,
        ket: `Kembalian ke ${pel.nama}`,
        ref_tabel: 'pembayaran',
        ref_id: 0
      });
    }
  }

  return payload;
}

// ===== MAIN PIPELINE =====
export function MainPipeline(payload) {
  let result = processReturns(payload);
  result = createNewConsignment(result);
  result = processPayment(result);
  return result;
    }
