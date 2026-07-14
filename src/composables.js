// ============================================================
// COMPOSABLES (Reactive Logic)
// ============================================================

import { ref, reactive } from 'vue';
import { C, FILTER_OPTS } from './constants.js';
import { todayStr, sum } from './utils.js';

// ===== useToast =====
export function useToast() {
  const toast = reactive({ show: false, message: '', type: C.TOAST.SUCCESS, _timer: null });
  const showToast = (msg, type = C.TOAST.SUCCESS) => {
    toast.message = msg;
    toast.type = type;
    toast.show = true;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.show = false; }, 3000);
  };
  return { toast, showToast };
}

// ===== useFilter =====
export function useFilter() {
  const filterKirim = ref(C.FILTER.ALL);
  const filterKas = ref(C.FILTER.ALL);
  const filterProduksi = ref(C.FILTER.ALL);
  const filterKirimDateStart = ref('');
  const filterKirimDateEnd = ref('');
  const filterKasDateStart = ref('');
  const filterKasDateEnd = ref('');
  const filterProduksiDateStart = ref('');
  const filterProduksiDateEnd = ref('');

  const setFilter = (type, key) => {
    if (type === 'kirim') filterKirim.value = key;
    else if (type === 'kas') filterKas.value = key;
    else if (type === 'produksi') filterProduksi.value = key;
  };

  const getPredicate = (key) => {
    const t = todayStr();
    const y = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const w = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const m = dayjs().subtract(1, 'month').format('YYYY-MM-DD');
    switch (key) {
      case C.FILTER.TODAY: return i => i.tgl === t;
      case C.FILTER.YESTERDAY: return i => i.tgl === y;
      case C.FILTER.WEEK: return i => i.tgl >= w;
      case C.FILTER.MONTH: return i => i.tgl >= m;
      default: return () => true;
    }
  };

  return {
    filterKirim, filterKas, filterProduksi,
    filterKirimDateStart, filterKirimDateEnd,
    filterKasDateStart, filterKasDateEnd,
    filterProduksiDateStart, filterProduksiDateEnd,
    setFilter, getPredicate
  };
}

// ===== useForm =====
export function useForm(data, konsinyasiLama, totalTagihan, saldoPelanggan, showToast) {
  const form = reactive({
    pelanggan_id: '',
    kirim_baru: [],
    bayar: 0,
    gunakanSaldo: false,
    bayarSekarang: true,
    simpanSaldo: false
  });
  const returInput = reactive({});
  const modalOpen = ref(false);
  const isSaving = ref(false);
  const errorMsg = ref('');

  const openModal = () => {
    form.pelanggan_id = '';
    form.kirim_baru = [];
    form.bayar = 0;
    form.gunakanSaldo = false;
    form.bayarSekarang = true;
    form.simpanSaldo = false;
    Object.keys(returInput).forEach(k => delete returInput[k]);
    errorMsg.value = '';
    modalOpen.value = true;
  };

  const closeModal = () => {
    modalOpen.value = false;
    isSaving.value = false;
  };

  const addKirimBaru = () => form.kirim_baru.push({ barang_id: '', qty: 0 });

  const validate = () => {
    if (!form.pelanggan_id) return 'Pilih pelanggan';
    for (const ks of konsinyasiLama.value) {
      const retur = returInput[ks.id] || 0;
      const totalKirim = ks.details?.reduce(sum, 0) || 0;
      if (retur > totalKirim) return `Retur ${ks.nomor} melebihi kirim (${totalKirim})`;
    }
    for (const item of form.kirim_baru) {
      if (item.barang_id && (!item.qty || item.qty <= 0)) return 'Qty harus > 0';
    }
    return null;
  };

  const submit = async (pipeline, saveCallback, onSuccess) => {
    const err = validate();
    if (err) { errorMsg.value = err; showToast(err, C.TOAST.ERROR); return; }
    isSaving.value = true;
    errorMsg.value = '';
    try {
      const payload = {
        pelangganId: form.pelanggan_id,
        returMap: { ...returInput },
        items: form.kirim_baru,
        bayar: form.bayar || 0,
        gunakanSaldo: form.gunakanSaldo,
        bayarSekarang: form.bayarSekarang,
        simpanSaldo: form.simpanSaldo,
        totalTagihan: totalTagihan.value
      };
      const result = pipeline(payload);
      Object.assign(data, result);
      await saveCallback();
      closeModal();
      onSuccess?.();
      showToast('Transaksi berhasil!', C.TOAST.SUCCESS);
    } catch (e) {
      errorMsg.value = e.message;
      showToast(e.message, C.TOAST.ERROR);
    } finally {
      isSaving.value = false;
    }
  };

  return {
    form, returInput, modalOpen, isSaving, errorMsg,
    openModal, closeModal, addKirimBaru, submit
  };
}
