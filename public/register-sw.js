if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Without a service worker the app still works online.
    });
  });
}

// Android/Chromium fire beforeinstallprompt once, often before React mounts. Keep it so the
// "Instala MONEO+" card (InstallPrompt) can open the system install dialog later.
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__moneoInstallPrompt = e;
  window.dispatchEvent(new Event('moneo:install-available'));
});
