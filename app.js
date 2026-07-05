// ============================================================
// PROMPT MANAGER — SPA Application Logic
// ============================================================

// ⚠️ IMPORTANTE: URL de tu Web App de Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbwmh8ug3HOLZARh_GP1XK7eodnKNIYvIVVAjs1duUcBVwvGlXgB-XGsxj8P0TIa28Y7/exec';

// ============================================================
// STATE
// ============================================================
const state = {
  prompts: [],
  filteredPrompts: [],
  categories: [],
  isLoading: false,
  editingId: null,
  deleteTarget: null,
  viewingPrompt: null, // Prompt currently open in the detail view
};

// ============================================================
// DOM REFERENCES
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Theme
  themeToggle: $('#themeToggle'),

  // Toolbar
  searchInput: $('#searchInput'),
  categoryFilter: $('#categoryFilter'),
  btnNewPrompt: $('#btnNewPrompt'),

  // Stats
  statTotal: $('#statTotal .stat-chip__number'),
  statCategories: $('#statCategories .stat-chip__number'),
  statFiltered: $('#statFiltered .stat-chip__number'),

  // States
  loadingState: $('#loadingState'),
  emptyState: $('#emptyState'),
  errorState: $('#errorState'),
  errorMessage: $('#errorMessage'),
  btnRetry: $('#btnRetry'),

  // Grid
  promptsGrid: $('#promptsGrid'),

  // Prompt Modal (Create/Edit)
  modalOverlay: $('#modalOverlay'),
  modalTitle: $('#modalTitle'),
  promptForm: $('#promptForm'),
  promptId: $('#promptId'),
  inputCategoria: $('#inputCategoria'),
  inputNombre: $('#inputNombre'),
  inputPrompt: $('#inputPrompt'),
  inputEjemplos: $('#inputEjemplos'),
  btnCloseModal: $('#btnCloseModal'),
  btnCancelModal: $('#btnCancelModal'),
  btnSubmitText: $('#btnSubmitText'),
  btnSubmitSpinner: $('#btnSubmitSpinner'),
  categorySuggestions: $('#categorySuggestions'),

  // Detail Modal
  detailOverlay: $('#detailOverlay'),
  detailCategory: $('#detailCategory'),
  detailTitle: $('#detailTitle'),
  detailPromptText: $('#detailPromptText'),
  detailExamplesText: $('#detailExamplesText'),
  detailExamplesContainer: $('#detailExamplesContainer'),
  btnCloseDetail: $('#btnCloseDetail'),
  btnCopyDetail: $('#btnCopyDetail'),
  btnCopyDetailText: $('#btnCopyDetailText'),
  btnEditFromDetail: $('#btnEditFromDetail'),
  btnCloseDetailBtn: $('#btnCloseDetailBtn'),

  // Delete Modal
  deleteOverlay: $('#deleteOverlay'),
  deletePromptName: $('#deletePromptName'),
  btnCancelDelete: $('#btnCancelDelete'),
  btnConfirmDelete: $('#btnConfirmDelete'),

  // Toast
  toastContainer: $('#toastContainer'),
};

// ============================================================
// THEME MANAGEMENT
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('prompt-manager-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark-mode');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('prompt-manager-theme', isDark ? 'dark' : 'light');
}

// ============================================================
// CATEGORY COLOR-CODING UTILITY
// ============================================================
function getCategoryColorClass(category) {
  const cat = (category || '').toLowerCase().trim();
  if (cat.includes('marketing') || cat.includes('vender') || cat.includes('publicidad')) return 'badge--marketing';
  if (cat.includes('seo') || cat.includes('posicionamiento') || cat.includes('keywords')) return 'badge--seo';
  if (cat.includes('redacción') || cat.includes('redaccion') || cat.includes('copy') || cat.includes('escribir')) return 'badge--copy';
  if (cat.includes('redes') || cat.includes('social') || cat.includes('instagram') || cat.includes('tiktok') || cat.includes('facebook')) return 'badge--social';
  if (cat.includes('estrategia') || cat.includes('negocio') || cat.includes('plan')) return 'badge--strategy';
  if (cat.includes('atención') || cat.includes('cliente') || cat.includes('soporte') || cat.includes('ayuda')) return 'badge--support';
  return 'badge--default';
}

// ============================================================
// API — Communication with Google Apps Script
// ============================================================
async function apiGet(action) {
  const url = `${API_URL}?action=${action}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
  return await response.json();
}

async function apiPost(data) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
  return await response.json();
}

// ============================================================
// DATA OPERATIONS
// ============================================================
async function loadPrompts() {
  showState('loading');

  try {
    const result = await apiGet('read');
    if (!result.success) throw new Error(result.error);

    state.prompts = result.data;
    extractCategories();
    applyFilters();
    showState('data');
  } catch (err) {
    console.error('Error loading prompts:', err);
    DOM.errorMessage.textContent = err.message || 'No se pudo conectar con la base de datos.';
    showState('error');
  }
}

async function savePrompt(formData) {
  const isEditing = !!state.editingId;
  const payload = {
    action: isEditing ? 'update' : 'create',
    ...formData,
  };

  if (isEditing) {
    payload.id = state.editingId;
  }

  const result = await apiPost(payload);
  if (!result.success) throw new Error(result.error);

  return result;
}

async function deletePrompt(id) {
  const result = await apiPost({ action: 'delete', id });
  if (!result.success) throw new Error(result.error);
  return result;
}

// ============================================================
// CATEGORIES
// ============================================================
function extractCategories() {
  const cats = new Set();
  state.prompts.forEach((p) => {
    if (p.categoria && p.categoria.trim()) {
      cats.add(p.categoria.trim());
    }
  });
  state.categories = Array.from(cats).sort();
  renderCategoryFilter();
  renderCategorySuggestions();
}

function renderCategoryFilter() {
  const current = DOM.categoryFilter.value;
  DOM.categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
  state.categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    DOM.categoryFilter.appendChild(opt);
  });
  DOM.categoryFilter.value = current;
}

function renderCategorySuggestions() {
  DOM.categorySuggestions.innerHTML = '';
  state.categories.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    DOM.categorySuggestions.appendChild(opt);
  });
}

// ============================================================
// FILTERS
// ============================================================
function applyFilters() {
  const search = DOM.searchInput.value.toLowerCase().trim();
  const category = DOM.categoryFilter.value;

  state.filteredPrompts = state.prompts.filter((p) => {
    const matchesCategory = !category || p.categoria === category;
    const matchesSearch =
      !search ||
      (p.nombre || '').toLowerCase().includes(search) ||
      (p.prompt || '').toLowerCase().includes(search) ||
      (p.categoria || '').toLowerCase().includes(search) ||
      (p.ejemplos || '').toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  renderGrid();
  updateStats();
}

// ============================================================
// RENDERING
// ============================================================
function showState(stateName) {
  DOM.loadingState.hidden = stateName !== 'loading';
  DOM.emptyState.hidden = stateName !== 'empty';
  DOM.errorState.hidden = stateName !== 'error';
  DOM.promptsGrid.hidden = stateName !== 'data';
}

function updateStats() {
  DOM.statTotal.textContent = state.prompts.length;
  DOM.statCategories.textContent = state.categories.length;
  DOM.statFiltered.textContent = state.filteredPrompts.length;
}

function renderGrid() {
  if (state.filteredPrompts.length === 0 && state.prompts.length === 0) {
    showState('empty');
    return;
  }

  if (state.filteredPrompts.length === 0) {
    DOM.promptsGrid.innerHTML = `
      <div class="state-message" style="grid-column: 1 / -1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <h2>Sin resultados</h2>
        <p>No se encontraron prompts con los filtros actuales.</p>
      </div>
    `;
    showState('data');
    return;
  }

  DOM.promptsGrid.innerHTML = state.filteredPrompts
    .map(
      (p, i) => {
        const catClass = getCategoryColorClass(p.categoria);
        return `
    <article class="prompt-card" style="animation-delay: ${i * 0.05}s" data-id="${p.id}">
      <div class="prompt-card__header">
        <span class="prompt-card__category ${catClass}">${escapeHtml(p.categoria)}</span>
        <div class="prompt-card__actions">
          <button class="btn btn--icon btn--icon-copy" title="Copiar Prompt" data-action="copy" data-id="${p.id}" aria-label="Copiar prompt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="btn btn--icon btn--icon-edit" title="Editar" data-action="edit" data-id="${p.id}" aria-label="Editar prompt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn--icon btn--icon-delete" title="Eliminar" data-action="delete" data-id="${p.id}" data-name="${escapeHtml(p.nombre)}" aria-label="Eliminar prompt">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <h3 class="prompt-card__name">${escapeHtml(p.nombre)}</h3>
      <p class="prompt-card__prompt">${escapeHtml(p.prompt)}</p>
      
      <div class="prompt-card__footer">
        <span class="prompt-card__date">${p.fecha ? `Creado: ${escapeHtml(p.fecha)}` : 'Fecha: N/A'}</span>
        <span class="prompt-card__view-more">Ver detalles</span>
      </div>
    </article>
  `;
      }
    )
    .join('');

  showState('data');
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================

// --- Prompt Modal (Create/Edit) ---
function openModal(mode, promptData = null) {
  state.editingId = mode === 'edit' && promptData ? promptData.id : null;

  DOM.modalTitle.textContent = mode === 'edit' ? 'Editar Prompt' : 'Nuevo Prompt';
  DOM.btnSubmitText.textContent = mode === 'edit' ? 'Guardar Cambios' : 'Guardar Prompt';

  if (promptData) {
    DOM.promptId.value = promptData.id;
    DOM.inputCategoria.value = promptData.categoria || '';
    DOM.inputNombre.value = promptData.nombre || '';
    DOM.inputPrompt.value = promptData.prompt || '';
    DOM.inputEjemplos.value = promptData.ejemplos || '';
  } else {
    DOM.promptForm.reset();
    DOM.promptId.value = '';
  }

  DOM.modalOverlay.hidden = false;
  void DOM.modalOverlay.offsetWidth;
  DOM.modalOverlay.classList.add('active');
  DOM.inputCategoria.focus();
}

function closeModal() {
  DOM.modalOverlay.classList.remove('active');
  setTimeout(() => {
    DOM.modalOverlay.hidden = true;
    DOM.promptForm.reset();
    state.editingId = null;
  }, 250);
}

// --- Detail Modal ---
function openDetailModal(promptData) {
  state.viewingPrompt = promptData;

  // Set category text and styles
  DOM.detailCategory.textContent = promptData.categoria;
  DOM.detailCategory.className = `prompt-card__category ${getCategoryColorClass(promptData.categoria)}`;

  DOM.detailTitle.textContent = promptData.nombre;
  DOM.detailPromptText.textContent = promptData.prompt;

  if (promptData.ejemplos && promptData.ejemplos.trim()) {
    DOM.detailExamplesText.textContent = promptData.ejemplos;
    DOM.detailExamplesContainer.style.display = 'block';
  } else {
    DOM.detailExamplesText.textContent = '';
    DOM.detailExamplesContainer.style.display = 'none';
  }

  DOM.detailOverlay.hidden = false;
  void DOM.detailOverlay.offsetWidth;
  DOM.detailOverlay.classList.add('active');
}

function closeDetailModal() {
  DOM.detailOverlay.classList.remove('active');
  setTimeout(() => {
    DOM.detailOverlay.hidden = true;
    state.viewingPrompt = null;
  }, 250);
}

// --- Delete Modal ---
function openDeleteModal(id, name) {
  state.deleteTarget = id;
  DOM.deletePromptName.textContent = name;

  DOM.deleteOverlay.hidden = false;
  void DOM.deleteOverlay.offsetWidth;
  DOM.deleteOverlay.classList.add('active');
}

function closeDeleteModal() {
  DOM.deleteOverlay.classList.remove('active');
  setTimeout(() => {
    DOM.deleteOverlay.hidden = true;
    state.deleteTarget = null;
  }, 250);
}

// ============================================================
// FORM SUBMISSION
// ============================================================
async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = {
    categoria: DOM.inputCategoria.value.trim(),
    nombre: DOM.inputNombre.value.trim(),
    prompt: DOM.inputPrompt.value.trim(),
    ejemplos: DOM.inputEjemplos.value.trim(),
  };

  if (!formData.categoria || !formData.nombre || !formData.prompt) {
    showToast('Por favor completa los campos obligatorios.', 'error');
    return;
  }

  DOM.btnSubmitText.hidden = true;
  DOM.btnSubmitSpinner.hidden = false;

  try {
    await savePrompt(formData);
    const action = state.editingId ? 'actualizado' : 'creado';
    showToast(`Prompt "${formData.nombre}" ${action} exitosamente.`, 'success');
    closeModal();
    await loadPrompts();
  } catch (err) {
    console.error('Error saving prompt:', err);
    showToast(`Error al guardar: ${err.message}`, 'error');
  } finally {
    DOM.btnSubmitText.hidden = false;
    DOM.btnSubmitSpinner.hidden = true;
  }
}

async function handleDelete() {
  if (!state.deleteTarget) return;

  try {
    await deletePrompt(state.deleteTarget);
    showToast('Prompt eliminado exitosamente.', 'success');
    closeDeleteModal();
    await loadPrompts();
  } catch (err) {
    console.error('Error deleting prompt:', err);
    showToast(`Error al eliminar: ${err.message}`, 'error');
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__message">${escapeHtml(message)}</span>
    <button class="toast__close" aria-label="Cerrar notificación">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  toast.querySelector('.toast__close').addEventListener('click', () => removeToast(toast));
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => removeToast(toast), 4000);
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 250);
}

// ============================================================
// UTILITIES
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function initEventListeners() {
  // Theme toggle
  DOM.themeToggle.addEventListener('click', toggleTheme);

  // Toolbar
  DOM.searchInput.addEventListener('input', debounce(applyFilters, 250));
  DOM.categoryFilter.addEventListener('change', applyFilters);
  DOM.btnNewPrompt.addEventListener('click', () => openModal('create'));

  // Retry
  DOM.btnRetry.addEventListener('click', loadPrompts);

  // Modal — Prompt Form
  DOM.btnCloseModal.addEventListener('click', closeModal);
  DOM.btnCancelModal.addEventListener('click', closeModal);
  DOM.promptForm.addEventListener('submit', handleFormSubmit);
  DOM.modalOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  // Modal — Detail Modal Actions
  DOM.btnCloseDetail.addEventListener('click', closeDetailModal);
  DOM.btnCloseDetailBtn.addEventListener('click', closeDetailModal);
  DOM.detailOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.detailOverlay) closeDetailModal();
  });

  DOM.btnCopyDetail.addEventListener('click', () => {
    if (!state.viewingPrompt) return;
    navigator.clipboard.writeText(state.viewingPrompt.prompt).then(() => {
      showToast('¡Prompt copiado al portapapeles!', 'success');

      const copyText = DOM.btnCopyDetailText;
      copyText.textContent = '¡Copiado!';
      DOM.btnCopyDetail.classList.add('btn--success');
      setTimeout(() => {
        copyText.textContent = 'Copiar Prompt';
        DOM.btnCopyDetail.classList.remove('btn--success');
      }, 2000);
    }).catch(err => {
      showToast('Error al copiar al portapapeles', 'error');
    });
  });

  DOM.btnEditFromDetail.addEventListener('click', () => {
    const prompt = state.viewingPrompt;
    closeDetailModal();
    setTimeout(() => {
      if (prompt) openModal('edit', prompt);
    }, 250);
  });

  // Delete modal
  DOM.btnCancelDelete.addEventListener('click', closeDeleteModal);
  DOM.btnConfirmDelete.addEventListener('click', handleDelete);
  DOM.deleteOverlay.addEventListener('click', (e) => {
    if (e.target === DOM.deleteOverlay) closeDeleteModal();
  });

  // Grid delegation — copy/edit/delete/view
  DOM.promptsGrid.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');

    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const id = parseInt(actionBtn.dataset.id);
      const prompt = state.prompts.find((p) => p.id === id);

      if (action === 'edit' && prompt) {
        openModal('edit', prompt);
      } else if (action === 'delete') {
        const name = actionBtn.dataset.name || 'este prompt';
        openDeleteModal(id, name);
      } else if (action === 'copy' && prompt) {
        navigator.clipboard.writeText(prompt.prompt).then(() => {
          showToast(`¡Prompt "${prompt.nombre}" copiado!`, 'success');

          // Temporary icon change
          const originalSVG = actionBtn.innerHTML;
          actionBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5" stroke-linecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          `;
          actionBtn.classList.add('copied');
          setTimeout(() => {
            actionBtn.innerHTML = originalSVG;
            actionBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          showToast('Error al copiar', 'error');
        });
      }
      return;
    }

    // Click on card body opens details modal
    const card = e.target.closest('.prompt-card');
    if (card) {
      const id = parseInt(card.dataset.id);
      const prompt = state.prompts.find((p) => p.id === id);
      if (prompt) {
        openDetailModal(prompt);
      }
    }
  });

  // Keyboard: Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!DOM.modalOverlay.hidden) closeModal();
      if (!DOM.detailOverlay.hidden) closeDetailModal();
      if (!DOM.deleteOverlay.hidden) closeDeleteModal();
    }
  });
}

// ============================================================
// INITIALIZATION
// ============================================================
function init() {
  initTheme();
  initEventListeners();
  loadPrompts();
}

document.addEventListener('DOMContentLoaded', init);
