function createRendererCommandDispatcher({ getWindow, debugLog }) {
  function send(channel, ...args) {
    const window = getWindow();
    if (!window || window.isDestroyed?.()) return false;
    window.webContents.send(channel, ...args);
    return true;
  }

  function sendLogged(channel, action) {
    debugLog?.info(action, {
      module: 'renderer-command-dispatcher',
      function: 'send',
      channel
    });
    return send(channel);
  }

  return {
    send,
    increaseFontSize: () => sendLogged('increase_font_size', 'Increasing font size'),
    decreaseFontSize: () => sendLogged('decrease_font_size', 'Decreasing font size'),
    toggleWaveform: () => sendLogged('toggle_wave_form', 'Toggling waveform'),
    toggleAdvancedSearch: () => sendLogged('toggle_advanced_search', 'Toggling advanced search'),
    closeAllTabs: () => send('close_all_tabs'),
    deleteSelectedSong: () => sendLogged('delete_selected_song', 'Sending delete selected song command'),
    editSelectedSong: () => sendLogged('edit_selected_song', 'Sending edit selected song command'),
    manageCategories: () => sendLogged('manage_categories', 'Sending manage categories command')
  };
}

export { createRendererCommandDispatcher };
export default createRendererCommandDispatcher;
