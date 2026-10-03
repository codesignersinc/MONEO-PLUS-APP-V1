if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js')
      .then(function (registration) {
        console.log('SW registered:', registration.scope);
      })
      .catch(function (error) {
        console.log('SW registration failed:', error);
      });
  });
}
