/**
 * Board menu: pure builder, driven by a snapshot of the board session.
 * Clicks post `menu:board-command` to the renderer through `send`, except the
 * two legacy imports, which stay in main (file-operations).
 */

// Windows/Linux treat '&' in a label as a mnemonic marker; macOS does not.
function escapeLabel(name, platform) {
  const text = String(name ?? '');
  return platform === 'win32' || platform === 'linux' ? text.replace(/&/g, '&&') : text;
}

function buildBoardMenu(state, { platform, send, fileOperations } = {}) {
  const status = state?.status ?? 'idle';
  const activeBoard = state?.activeBoard ?? null;
  const boards = Array.isArray(state?.boards) ? state.boards : [];
  const ready = status === 'ready';
  const label = (name) => escapeLabel(name, platform);
  const emit = (command, boardId) => () => send?.(command, boardId);

  const quoted = (verb) => (activeBoard ? `${verb} "${label(activeBoard.name)}"` : verb);
  const perBoard = (command) => boards.map((board) => ({
    label: `${label(board.name)}…`,
    enabled: ready,
    click: emit(command, board.id)
  }));

  return {
    label: 'Board',
    submenu: [
      ...boards.map((board) => {
        const isActive = activeBoard?.id === board.id;
        return {
          label: label(board.name),
          type: 'radio',
          checked: isActive,
          enabled: ready,
          // Electron fires click on an already-checked radio; that must not act as a Revert.
          click: () => { if (!isActive) send?.('switch', board.id); }
        };
      }),
      { type: 'separator' },
      { label: quoted('Update'), enabled: ready && !!activeBoard, click: emit('update') },
      { label: 'New Board…', enabled: ready, click: emit('new') },
      { label: quoted('Revert to'), enabled: ready && !!activeBoard, click: emit('revert') },
      { label: 'Rename Board', enabled: ready, submenu: perBoard('rename') },
      { label: 'Delete Board', enabled: ready, submenu: perBoard('delete') },
      { type: 'separator' },
      { label: 'Import Board…', enabled: ready, click: emit('import') },
      {
        label: 'Import Hotkey File…',
        click: () => { fileOperations?.loadHotkeysFile?.(); }
      },
      {
        label: 'Import Holding Tank File…',
        click: () => { fileOperations?.loadHoldingTankFile?.(); }
      }
    ]
  };
}

export { buildBoardMenu };
export default buildBoardMenu;
