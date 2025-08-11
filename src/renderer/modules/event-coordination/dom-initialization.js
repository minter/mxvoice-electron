/**
 * DOM Initialization Module
 * 
 * Handles DOM structure initialization that was previously in renderer.js.
 * Sets up tab structure, context menus, and other DOM elements.
 */

export default class DOMInitialization {
  constructor(dependencies = {}) {
    this.electronAPI = dependencies.electronAPI || window.electronAPI;
    this.db = null;
    this.store = null;
    this.debugLog = dependencies.debugLog || window.debugLog;
    this.moduleRegistry = dependencies.moduleRegistry || window.moduleRegistry;
    
    this.initialized = false;
  }

  /**
   * Initialize DOM structure
   * This replaces the DOM setup code from renderer.js $(document).ready()
   */
  async initializeDOMStructure() {
    try {
      if (this.initialized) {
        this.debugLog?.warn('DOM structure already initialized');
        return;
      }

      this.debugLog?.info('Initializing DOM structure...');

      // Initialize progress bar
      this.initializeProgressBar();

      // Initialize Bootstrap tooltips across the document
      try {
        const { initTooltip } = await import('../ui/bootstrap-adapter.js');
        initTooltip('[data-bs-toggle="tooltip"]');
        this.debugLog?.debug('Bootstrap tooltips initialized');
      } catch {}

      // Set up hotkey and holding tank tabs (lines 684-694 from renderer.js)
      this.setupTabStructure();

      // Set up context menu (lines 696-730 from renderer.js)
      this.setupContextMenu();

      // Hide search results header initially (line 1122 from renderer.js)
      this.initializeSearchResults();

      // Set up first run modal logic (lines 1174-1214 from renderer.js)
      await this.setupFirstRunModal();

      this.initialized = true;
      this.debugLog?.info('DOM structure initialized successfully');

    } catch (error) {
      this.debugLog?.error('Failed to initialize DOM structure:', error);
    }
  }

  /**
   * Initialize progress bar to 0% width
   */
  initializeProgressBar() {
    const progress = document.getElementById('audio_progress');
    if (progress) progress.style.width = '0%';
    this.debugLog?.debug('Progress bar initialized to 0%');
  }

  /**
   * Set up hotkey and holding tank tabs (cloning tabs 2-5)
   */
  setupTabStructure() {
    try {
      // Set up hotkey and holding tank tabs for tabs 2-5
      for (let i = 2; i <= 5; i++) {
        // Clone hotkey tab
        const baseHotkeys = document.getElementById('hotkeys_list_1');
        const hotkeysContainer = document.getElementById('hotkey-tab-content');
        if (baseHotkeys && hotkeysContainer) {
          const clone = baseHotkeys.cloneNode(true);
          clone.id = `hotkeys_list_${i}`;
          clone.classList.remove('show', 'active');
          hotkeysContainer.appendChild(clone);
        }

        // Clone holding tank tab
        const baseHolding = document.getElementById('holding_tank_1');
        const holdingContainer = document.getElementById('holding-tank-tab-content');
        if (baseHolding && holdingContainer) {
          const clone2 = baseHolding.cloneNode(true);
          clone2.id = `holding_tank_${i}`;
          clone2.classList.remove('show', 'active');
          holdingContainer.appendChild(clone2);
        }
      }

      this.debugLog?.debug('Tab structure set up for tabs 2-5');

    } catch (error) {
      this.debugLog?.error('Failed to setup tab structure:', error);
    }
  }

  /**
   * Set up context menu for song operations
   */
  setupContextMenu() {
    try {
      // Native context menu implemented in place of jQuery plugin
      const menu = document.createElement('div');
      menu.id = 'mxv-context-menu';
      menu.className = 'mxv-context-menu';
      Object.assign(menu.style, {
        position: 'fixed', zIndex: '9999', display: 'none', minWidth: '200px'
      });
      const mkItem = (label, onClick) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.textContent = label;
        item.className = 'mxv-context-item';
        item.addEventListener('click', (e) => { e.stopPropagation(); hide(); onClick?.(); });
        return item;
      };
      const playItem = mkItem('Play', () => { if (window.playSelected) window.playSelected(); });
      const editItem = mkItem('Edit', () => { if (window.editSelectedSong) window.editSelectedSong(); });
      const deleteItem = mkItem('Delete', () => { if (window.deleteSelectedSong) window.deleteSelectedSong(); });
      menu.append(playItem, editItem, deleteItem);
      document.body.appendChild(menu);

      const hide = () => { menu.style.display = 'none'; };
      const show = (x, y, dynamicDeleteLabel) => {
        deleteItem.textContent = dynamicDeleteLabel || 'Delete';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
      };

      document.addEventListener('click', hide);
      window.addEventListener('blur', hide);
      window.addEventListener('resize', hide);

      document.addEventListener('contextmenu', (event) => {
        const row = event.target?.closest('.context-menu');
        if (!row) return;
        event.preventDefault();
        const prev = document.getElementById('selected_row');
        if (prev) prev.removeAttribute('id');
        row.id = 'selected_row';
        let label = 'Delete';
        const holdingCol = document.getElementById('holding-tank-column');
        const hotkeysContent = document.getElementById('hotkey-tab-content');
        if (holdingCol && holdingCol.contains(row)) label = 'Remove from Holding Tank';
        else if (hotkeysContent && hotkeysContent.contains(row)) label = 'Remove from Hotkey';
        const x = Math.min(event.clientX, window.innerWidth - 220);
        const y = Math.min(event.clientY, window.innerHeight - 150);
        show(x, y, label);
      });

      this.debugLog?.debug('Context menu set up (native)');

    } catch (error) {
      this.debugLog?.error('Failed to setup context menu:', error);
    }
  }

  /**
   * Initialize search results display
   */
  initializeSearchResults() {
    const thead = document.querySelector('#search_results thead');
    if (thead) thead.style.display = 'none';
    this.debugLog?.debug('Search results header hidden');
  }

  /**
   * Set up first run modal logic
   */
  async setupFirstRunModal() {
    try {
      // Use new database API for song count
      if (this.electronAPI && this.electronAPI.database) {
        const result = await this.electronAPI.database.query("SELECT count(*) as count from mrvoice WHERE 1");
        if (result.success && result.data.length > 0 && result.data[0].count <= 1) {
          try {
            const { showModal } = await import('../ui/bootstrap-adapter.js');
            showModal('#firstRunModal');
          } catch {}
          this.debugLog?.info('First run modal shown - database has <= 1 songs');
        }
      }

    } catch (error) {
      this.debugLog?.error('Database API error', error);
    }
  }

  /**
   * Legacy fallback removed
   */
  async setupFirstRunModalFallback() {}

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      components: {
        progressBar: !!document.getElementById('audio_progress'),
        tabs: !!document.getElementById('hotkeys_list_2'),
        contextMenu: document.querySelectorAll('.context-menu').length > 0,
        searchResults: !!document.getElementById('search_results')
      }
    };
  }
}
