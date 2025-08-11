// Bootstrap 5 Adapter for UI interactions
// Centralizes Bootstrap JS API usage so code can call simple helpers

export function showModal(selector, options = { backdrop: true, keyboard: true }) {
  const element = document.querySelector(selector);
  if (!element) return;
  const instance = bootstrap.Modal.getOrCreateInstance(element, options);
  instance.show();
}

export function hideModal(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  const instance = bootstrap.Modal.getOrCreateInstance(element);
  instance.hide();
}

export function hideAllModals() {
  document.querySelectorAll('.modal.show').forEach((element) => {
    bootstrap.Modal.getOrCreateInstance(element).hide();
  });
}

export function showTab(selector) {
  const element = document.querySelector(selector);
  if (!element) return;
  bootstrap.Tab.getOrCreateInstance(element).show();
}

export function initTooltip(selector = '[data-bs-toggle="tooltip"]') {
  document.querySelectorAll(selector).forEach((element) => {
    new bootstrap.Tooltip(element);
  });
}

export default {
  showModal,
  hideModal,
  hideAllModals,
  showTab,
  initTooltip,
};


