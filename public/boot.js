/*
 * Se ejecuta antes de pintar la página para aplicar el estilo y el tema
 * guardados y evitar un destello con los colores predeterminados.
 * La app vuelve a leer y validar las preferencias completas al iniciar,
 * así que aquí solo se aceptan valores conocidos.
 */
(function () {
  var root = document.documentElement;
  try {
    var raw = window.localStorage.getItem('uamc:preferences');
    if (!raw) return;
    var appearance = (JSON.parse(raw) || {}).appearance || {};
    if (appearance.style === 'glass' || appearance.style === 'maximal') root.setAttribute('data-style', appearance.style);
    if (appearance.theme === 'dark' || appearance.theme === 'light') root.setAttribute('data-theme', appearance.theme);
  } catch (error) {
    // Almacenamiento bloqueado o JSON dañado: la app lo detecta y lo repara al montar.
    root.setAttribute('data-boot-warning', 'preferences-unreadable');
  }
})();
