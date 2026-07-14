// ============================================================
// MAIN ENTRY - Vue App
// ============================================================

// ============================================================
// MAIN ENTRY - dengan fallback global
// ============================================================

// Pastikan dayjs dan Dexie tersedia
if (typeof window.dayjs === 'undefined') {
  console.warn('dayjs tidak ditemukan, menggunakan fallback');
  window.dayjs = (date) => ({ format: () => date || '-', subtract: () => ({ format: () => '' }) });
}
if (typeof window.Dexie === 'undefined') {
  console.warn('Dexie tidak ditemukan, aplikasi tidak akan berfungsi');
  alert('Dexie tidak ditemukan. Pastikan koneksi internet dan CDN tersedia.');
}

import { createApp, ref, reactive, computed, watch, onMounted } from 'vue';
import { C, TABS, FILTER_OPTS, SEED_TEMPLATE } from './constants.js';
import { formatRupiah, formatDate, todayStr, sum } from './utils.js';
import { Query, Command } from './db.js';
import { useToast, useFilter, useForm } from './composables.js';
import { MainPipeline, injectContext } from './pipeline.js';
import { debounce } from './directives.js';

// ... sisanya sama seperti main.js sebelumnya, 
// tapi pastikan semua import menggunakan ekstensi .js (sudah).
// ============================================================
// APP
// ============================================================
const app = createApp({
  setup() {
    // ---- GLOBAL ERROR STATE ----
    const hasGlobalError = ref(false);
    const globalErrorMessage = ref('');

    // ---- TOAST ----
    const { toast, showToast } = useToast();

    // ---- FILTER ----
    const filter = useFilter();
    const {
      filterKirim, filterKas, filterProduksi,
      filterKirimDateStart, filterKirimDateEnd,
      filterKasDateStart, filterKasDateEnd,
      filterProduksiDateStart, filterProduksiDateEnd,
      setFilter, getPredicate
    } = filter;

    // ---- STATE ----
    const queryState = reactive({
      pelanggan: [],
      barang: [],
      konsinyasi: [],
      kas: [],
      pembayaran: [],
      produksi: [],
      stok_log: [],
      saldo_log: []
    });
    const isLoading = ref(false);

    // ---- UI STATE ----
    const activeTab = ref(C.TAB.KIRIM);
    const searchKirim = ref('');
    const searchKas = ref('');
    const pageKirim = ref(1);
    const pageKas = ref(1);
    const pageSize = 10;

    // ---- FORM ----
    const konsinyasiLama = computed(() => {
      if (!form.pelanggan_id) return [];
      return queryState.konsinyasi.filter(k =>
        k.pelanggan_id === form.pelanggan_id && k.status === C.STATUS.AKTIF
      );
    });
    const saldoPelanggan = computed(() =>
      queryState.pelanggan.find(p => p.id === form.pelanggan_id)?.saldo || 0
    );
    const totalTagihan = computed(() => {
      const totalBaru = form.kirim_baru.reduce((acc, item) => {
        if (!item.barang_id || !item.qty) return acc;
        const b = queryState.barang.find(br => br.id === item.barang_id);
        return acc + (b ? item.qty * b.harga_jual : 0);
      }, 0);
      const totalLama = konsinyasiLama.value.reduce((acc, ks) => acc + (ks.sisa_piutang || 0), 0);
      return form.bayarSekarang ? totalLama + totalBaru : totalLama;
    });

    const formHelper = useForm(
      queryState,
      konsinyasiLama,
      totalTagihan,
      saldoPelanggan,
      showToast
    );
    const { form, returInput, modalOpen, isSaving, errorMsg, openModal, closeModal, addKirimBaru, submit } = formHelper;

    // ---- COMPUTED ----
    const filteredKirim = computed(() => {
      let items = queryState.konsinyasi.filter(k => k.status === C.STATUS.AKTIF);
      const pred = getPredicate(filterKirim.value);
      items = items.filter(pred);
      if (filterKirimDateStart.value && filterKirimDateEnd.value) {
        items = items.filter(i => i.tgl >= filterKirimDateStart.value && i.tgl <= filterKirimDateEnd.value);
      }
      const q = searchKirim.value.trim().toLowerCase();
      if (q) {
        items = items.filter(k => {
          const nama = queryState.pelanggan.find(p => p.id === k.pelanggan_id)?.nama?.toLowerCase() || '';
          return k.nomor.toLowerCase().includes(q) || nama.includes(q);
        });
      }
      return items;
    });
    const paginatedKirim = computed(() => filteredKirim.value.slice(0, pageKirim.value * pageSize));

    const filteredKas = computed(() => {
      let items = queryState.kas;
      const pred = getPredicate(filterKas.value);
      items = items.filter(pred);
      if (filterKasDateStart.value && filterKasDateEnd.value) {
        items = items.filter(i => i.tgl >= filterKasDateStart.value && i.tgl <= filterKasDateEnd.value);
      }
      const q = searchKas.value.trim().toLowerCase();
      if (q) {
        items = items.filter(k => k.kategori.toLowerCase().includes(q) || k.ket.toLowerCase().includes(q));
      }
      return items;
    });
    const paginatedKas = computed(() => filteredKas.value.slice(0, pageKas.value * pageSize));

    const filteredProduksi = computed(() => {
      let items = queryState.produksi;
      const pred = getPredicate(filterProduksi.value);
      items = items.filter(pred);
      if (filterProduksiDateStart.value && filterProduksiDateEnd.value) {
        items = items.filter(i => i.tgl >= filterProduksiDateStart.value && i.tgl <= filterProduksiDateEnd.value);
      }
      return items;
    });

    const totalSaldoPelanggan = computed(() =>
      queryState.pelanggan.reduce((acc, p) => acc + (p.saldo || 0), 0)
    );
    const auditLogs = computed(() => {
      const logs = [...queryState.stok_log, ...queryState.saldo_log];
      return logs.sort((a, b) => b.id - a.id).slice(0, 10);
    });
    const getPelanggan = (id) => queryState.pelanggan.find(p => p.id === id);

    // ---- DATA LOAD ----
    const loadData = async () => {
      isLoading.value = true;
      try {
        const data = await Query.all();
        Object.assign(queryState, data);
        injectContext(data);
        if (!data.pelanggan.length) await seedData();
      } catch (e) {
        hasGlobalError.value = true;
        globalErrorMessage.value = e.message || 'Gagal memuat data';
        console.error('[Load Error]', e);
      } finally {
        isLoading.value = false;
      }
    };

    const seedData = async () => {
      try {
        const data = structuredClone(SEED_TEMPLATE);
        Object.assign(queryState, data);
        injectContext(data);
        await Command.saveAll(data);
      } catch (e) {
        throw new Error('Gagal seed data: ' + e.message);
      }
    };

    const resetData = async () => {
      if (!confirm('Reset semua data ke demo?')) return;
      try {
        await Command.reset();
        await loadData();
        searchKirim.value = '';
        searchKas.value = '';
        pageKirim.value = 1;
        pageKas.value = 1;
        closeModal();
        showToast('Data direset', C.TOAST.INFO);
      } catch (e) {
        showToast('Gagal reset: ' + e.message, C.TOAST.ERROR);
      }
    };

    // ---- SUBMIT HANDLER ----
    const handleSubmit = () => {
      submit(MainPipeline, async () => {
        await Command.saveAll(queryState);
      }, () => {
        pageKirim.value = 1;
      });
    };

    // ---- ROUTING ----
    const setTab = (key) => {
      activeTab.value = key;
      window.location.hash = key;
    };
    const syncTabFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (TABS.some(t => t.key === hash)) activeTab.value = hash;
    };
    window.addEventListener('hashchange', syncTabFromHash);

    // ---- RELOAD / RESET ERROR ----
    const reloadApp = () => window.location.reload();
    const resetAndReload = async () => {
      try {
        await Command.reset();
        window.location.reload();
      } catch (e) {
        window.location.reload();
      }
    };

    // ---- LIFECYCLE ----
    onMounted(() => {
      syncTabFromHash();
      loadData();
    });

    // ---- AUTO-SAVE ----
    watch(
      () => [
        queryState.pelanggan,
        queryState.barang,
        queryState.konsinyasi,
        queryState.kas,
        queryState.pembayaran,
        queryState.stok_log,
        queryState.saldo_log
      ],
      () => {
        if (!isLoading.value && !hasGlobalError.value) {
          Command.saveAll(queryState).catch(e => console.warn('Auto-save error:', e));
        }
      },
      { deep: true }
    );

    // ---- EXPOSE ----
    return {
      // Error
      hasGlobalError,
      globalErrorMessage,
      reloadApp,
      resetAndReload,

      // Data
      queryState,
      isLoading,

      // Toast
      toast,
      showToast,

      // UI
      activeTab,
      TABS,
      FILTER_OPTS,
      C,
      searchKirim,
      searchKas,
      pageKirim,
      pageKas,
      pageSize,

      // Filter
      filterKirim,
      filterKas,
      filterProduksi,
      filterKirimDateStart,
      filterKirimDateEnd,
      filterKasDateStart,
      filterKasDateEnd,
      filterProduksiDateStart,
      filterProduksiDateEnd,
      setFilter,

      // Computed
      filteredKirim,
      paginatedKirim,
      filteredKas,
      paginatedKas,
      filteredProduksi,
      konsinyasiLama,
      saldoPelanggan,
      totalTagihan,
      totalSaldoPelanggan,
      auditLogs,
      getPelanggan,

      // Form
      form,
      returInput,
      modalOpen,
      isSaving,
      errorMsg,
      openModal,
      closeModal,
      addKirimBaru,
      handleSubmit,

      // Actions
      resetData,
      setTab,

      // Utilities
      today: todayStr,
      formatRupiah,
      formatDate,
      sum
    };
  }
});

// ============================================================
// DIRECTIVES
// ============================================================
app.directive('debounce', debounce);

// ============================================================
// ERROR BOUNDARY
// ============================================================
app.config.errorHandler = (err, vm, info) => {
  console.error('[Global Error]', err, info);
  try {
    if (vm?.$root?.showToast) {
      vm.$root.showToast('⚠️ ' + err.message, C.TOAST.ERROR);
    } else if (vm?.$root?.hasGlobalError !== undefined) {
      vm.$root.hasGlobalError = true;
      vm.$root.globalErrorMessage = err.message || 'Terjadi kesalahan';
    }
  } catch (_) {
    alert('Error: ' + err.message);
  }
};

// ============================================================
// MOUNT
// ============================================================
app.mount('#app');
