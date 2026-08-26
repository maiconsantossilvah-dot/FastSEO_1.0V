const pendingLoads = new Map();

/**
 * Carrega uma dependência de CDN uma única vez e valida seu conteúdo com SRI.
 * O hash fixo impede que uma alteração inesperada no CDN execute no FastSEO.
 */
export function loadExternalScript({ src, integrity, globalName, errorMessage }) {
  if (globalName && globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
  if (pendingLoads.has(src)) return pendingLoads.get(src);

  const load = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      const loadedGlobal = globalName ? globalThis[globalName] : true;
      if (!loadedGlobal) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(loadedGlobal);
    };
    script.onerror = () => reject(new Error(errorMessage));
    document.head.appendChild(script);
  }).catch(error => {
    pendingLoads.delete(src);
    throw error;
  });

  pendingLoads.set(src, load);
  return load;
}
