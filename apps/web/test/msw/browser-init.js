// Подключается через page.addInitScript в тесте
(() => {
  // Подменяем fetch XHR уровнем SW MSW (достаточно наличия mockServiceWorker.js в /public)
  // В тестах Playwright можно просто полагаться на Node-handlers через route(), но
  // если нужен именно SW: раскомментируйте ниже.
  // navigator.serviceWorker.register('/mockServiceWorker.js');
})();
