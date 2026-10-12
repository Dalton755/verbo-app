// Ajustes exclusivos do leitor Shalom: o componente VERBO original é
// reaproveitado sem alterações no projeto principal.
function replaceOnce(code, needle, replacement) {
  const first = code.indexOf(needle);
  if (first < 0 || code.indexOf(needle, first + needle.length) >= 0) {
    throw new Error("Shalom: estrutura de paginação do leitor mudou. Revisar integração antes do build.");
  }
  return code.slice(0, first) + replacement + code.slice(first + needle.length);
}

export function patchReaderPagination(code) {
  let updated = code;

  // Timer com cleanup no unmount, sem novos renders durante a troca de página.
  const ref = "const contadorPaginaRef =\n        useRef(null);";
  updated = replaceOnce(updated, ref, ref + `
    const shalomNavTimerRef = useRef(null);
    useEffect(() => () => {
        if (shalomNavTimerRef.current !== null) {
            window.clearTimeout(shalomNavTimerRef.current);
        }
    }, []);
`);

  const sync = "function sincronizarControlesPagina(\n        pagina,\n        total,\n    ) {";
  updated = replaceOnce(updated, sync, `
    function mostrarControlesPaginaShalom() {
        const controle = pagedViewportRef.current
            ?.querySelector(".book-page-navigation");
        if (!controle) return;

        controle.classList.add("shalom-page-nav-visible");
        if (shalomNavTimerRef.current !== null) {
            window.clearTimeout(shalomNavTimerRef.current);
        }
        shalomNavTimerRef.current = window.setTimeout(() => {
            controle.classList.remove("shalom-page-nav-visible");
            shalomNavTimerRef.current = null;
        }, 2400);
    }

    ` + sync);

  // Sincronizar página ocorre após swipe, botões, teclas e repaginação.
  const previousButton = "        if (\n            botaoPaginaAnteriorRef\n                .current\n        ) {";
  updated = replaceOnce(updated, previousButton,
    "        mostrarControlesPaginaShalom();\n\n" + previousButton);

  // Um toque na página também revela os botões sem interromper o swipe.
  const pointer = "function iniciarArrastoPagina(\n        event,\n    ) {";
  updated = replaceOnce(updated, pointer, pointer + "\n        mostrarControlesPaginaShalom();");

  return updated;
}
