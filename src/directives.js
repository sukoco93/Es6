// ============================================================
// CUSTOM DIRECTIVES
// ============================================================

export const debounce = {
  mounted(el, binding) {
    const delay = Number(binding.arg) || 300;
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        binding.value = el.value;
      }, delay);
    };
    el.addEventListener('input', handler);
    el._debounceCleanup = () => el.removeEventListener('input', handler);
  },
  unmounted(el) {
    el._debounceCleanup?.();
  }
};
