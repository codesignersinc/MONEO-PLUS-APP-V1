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

// Inside the Android app (Trusted Web Activity) mark this tab; see src/lib/appShell.ts.
try {
  if (
    new URLSearchParams(location.search).get('source') === 'android' ||
    document.referrer.indexOf('android-app://plus.moneo.app') === 0
  ) {
    sessionStorage.setItem('moneo.shell', 'android');
  }
} catch (e) {
  // Storage blocked: the app still works; the checkout check falls back to the URL.
}
