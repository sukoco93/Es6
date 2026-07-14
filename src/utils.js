// ============================================================
// UTILITY FUNCTIONS - menggunakan window.dayjs
// ============================================================

const dayjs = window.dayjs;

export const formatRupiah = (v, d = '0') =>
  v == null || isNaN(v) ? d : Math.round(v).toLocaleString('id-ID');

export const formatDate = (iso) =>
  iso ? dayjs(iso).format('DD MMM YYYY') : '-';

export const todayStr = () => dayjs().format('YYYY-MM-DD');

export const makeId = (prefix = 'KSN-') =>
  prefix + Date.now().toString().slice(-6);

export const sum = (a, b) => a + b;
