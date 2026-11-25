(() => {
  const storageKey = 'sudoku.theme.v1';
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const status = document.getElementById('theme-status');

  function applyTheme(theme, persist = false) {
    root.dataset.theme = theme;
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.innerText = isDark ? 'Switch to light mode' : 'Switch to dark mode';

    if (!persist) return;
    try {
      window.localStorage.setItem(storageKey, theme);
      status.innerText = `${isDark ? 'Dark' : 'Light'} mode enabled.`;
    } catch (error) {
      status.innerText = 'Theme changed, but the preference could not be saved.';
    }
  }

  let theme = 'light';
  try {
    const savedTheme = window.localStorage.getItem(storageKey);
    if (savedTheme === 'dark') {
      theme = 'dark';
    } else if (savedTheme !== null && savedTheme !== 'light') {
      status.innerText = 'Invalid saved theme; using light mode.';
    }
  } catch (error) {
    status.innerText = 'Theme preference could not be loaded; using light mode.';
  }

  applyTheme(theme);
  toggle.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
})();
