// ============================================================
// VÉRTICE — Router SPA
// assets/js/router.js
// ============================================================

const routes = {};
let currentRoute = null;

/**
 * Registrar uma rota
 * @param {string} path
 * @param {Function} handler - recebe params do route
 */
export function route(path, handler) {
  routes[path] = handler;
}

/**
 * Navegar para uma rota
 */
export function navigate(path, replace = false) {
  if (replace) {
    history.replaceState({}, '', path);
  } else {
    history.pushState({}, '', path);
  }
  dispatch(path);
}

/**
 * Despachar a rota atual
 */
function dispatch(path) {
  // Limpa query string para matching
  const [pathname] = path.split('?');

  // Match exato
  if (routes[pathname]) {
    currentRoute = pathname;
    routes[pathname]({ path: pathname });
    return;
  }

  // Match com parâmetros /:param
  for (const pattern of Object.keys(routes)) {
    const match = matchRoute(pattern, pathname);
    if (match) {
      currentRoute = pattern;
      routes[pattern]({ path: pathname, params: match });
      return;
    }
  }

  // 404 fallback
  if (routes['*']) {
    routes['*']({ path: pathname });
  }
}

function matchRoute(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts    = path.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Iniciar o router
 */
export function startRouter() {
  window.addEventListener('popstate', () => dispatch(location.pathname));
  dispatch(location.pathname);
}

export function currentPath() {
  return location.pathname;
}
