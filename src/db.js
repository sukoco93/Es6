// ============================================================
// DATABASE LAYER (Dexie) - CQRS: Query & Command
// ============================================================

const db = new Dexie('ERP_Tempe');
db.version(1).stores({
  pelanggan: 'id, nama',
  barang: 'id, nama, kategori',
  konsinyasi: 'id, tgl, pelanggan_id, status',
  kas: 'id, tgl, jenis',
  pembayaran: 'id, tgl, pelanggan_id',
  produksi: 'id, tgl',
  stok_log: 'id, tgl, barang_id',
  saldo_log: 'id, tgl, pelanggan_id'
});
db.open();

// Sanitasi untuk menghindari DataCloneError
function sanitizeForDB(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    const safe = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const val = obj[key];
      if (typeof val === 'function' || val === undefined) continue;
      if (val && typeof val === 'object') {
        try { safe[key] = sanitizeForDB(val); } catch { safe[key] = null; }
      } else safe[key] = val;
    }
    return safe;
  }
}

// ===== QUERY =====
export const Query = {
  async all() {
    const [pelanggan, barang, konsinyasi, kas, pembayaran, produksi, stok_log, saldo_log] = await Promise.all([
      db.pelanggan.toArray(),
      db.barang.toArray(),
      db.konsinyasi.toArray(),
      db.kas.toArray(),
      db.pembayaran.toArray(),
      db.produksi.toArray(),
      db.stok_log.toArray(),
      db.saldo_log.toArray()
    ]);
    return { pelanggan, barang, konsinyasi, kas, pembayaran, produksi, stok_log, saldo_log };
  }
};

// ===== COMMAND =====
export const Command = {
  async saveAll(data) {
    const sanitized = {};
    for (const [key, val] of Object.entries(data)) {
      try {
        sanitized[key] = sanitizeForDB(val) || [];
      } catch {
        sanitized[key] = [];
      }
    }
    await Promise.all([
      db.pelanggan.bulkPut(sanitized.pelanggan || []),
      db.barang.bulkPut(sanitized.barang || []),
      db.konsinyasi.bulkPut(sanitized.konsinyasi || []),
      db.kas.bulkPut(sanitized.kas || []),
      db.pembayaran.bulkPut(sanitized.pembayaran || []),
      db.stok_log.bulkPut(sanitized.stok_log || []),
      db.saldo_log.bulkPut(sanitized.saldo_log || [])
    ]);
  },

  async reset() {
    await db.delete();
    await db.open();
  }
};
