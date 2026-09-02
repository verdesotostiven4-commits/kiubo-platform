(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  let activeSheet = null;
  let drag = null;

  // Quantity changes in the product sheet used to rebuild the whole sheet and
  // could reset its scroll position. Preserve it across DOM refreshes.
  const sheetContent = $('#productSheetContent');
  if (sheetContent) {
    let savedScroll = 0;
    const observer = new MutationObserver(() => {
      const sheet = $('#productSheet');
      if (!sheet || sheet.hidden) return;
      requestAnimationFrame(() => {
        if (savedScroll > 0) sheet.scrollTop = savedScroll;
      });
    });
    observer.observe(sheetContent, { childList: true, subtree: false });
    $('#productSheet')?.addEventListener('scroll', e => { savedScroll = e.currentTarget.scrollTop; }, { passive: true });
  }

  // Native-feeling swipe-to-dismiss. A downward drag from the top area or
  // handle follows the finger; a sufficiently large/fast gesture closes.
  function startDrag(e) {
    const sheet = e.target.closest('.bottom-sheet.visible');
    if (!sheet || e.pointerType === 'mouse') return;
    const rect = sheet.getBoundingClientRect();
    const nearTop = e.clientY - rect.top < 92;
    const handle = e.target.closest('.sheet-handle');
    if (!nearTop && !handle) return;
    activeSheet = sheet;
    drag = { id: e.pointerId, y: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0 };
    sheet.classList.add('is-dragging');
    try { sheet.setPointerCapture(e.pointerId); } catch {}
  }
  function moveDrag(e) {
    if (!drag || e.pointerId !== drag.id || !activeSheet) return;
    const dy = Math.max(0, e.clientY - drag.y);
    const now = performance.now();
    drag.velocity = (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
    drag.lastY = e.clientY; drag.lastT = now;
    activeSheet.style.transform = `translate3d(0, ${dy}px, 0)`;
    const backdrop = $('#sheetBackdrop');
    if (backdrop) backdrop.style.opacity = String(Math.max(.12, 1 - dy / Math.max(360, innerHeight * .7)));
    if (dy > 3) e.preventDefault();
  }
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id || !activeSheet) return;
    const dy = Math.max(0, e.clientY - drag.y);
    const close = dy > Math.min(150, innerHeight * .18) || drag.velocity > .7;
    const sheet = activeSheet;
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    const backdrop = $('#sheetBackdrop'); if (backdrop) backdrop.style.opacity = '';
    drag = null; activeSheet = null;
    if (close) $('[data-close-sheet]', sheet)?.click();
  }
  document.addEventListener('pointerdown', startDrag, { passive: true });
  document.addEventListener('pointermove', moveDrag, { passive: false });
  document.addEventListener('pointerup', endDrag, { passive: true });
  document.addEventListener('pointercancel', endDrag, { passive: true });

  // Avoid expensive hover paint paths on touch-only devices.
  if (matchMedia('(hover: none)').matches) document.documentElement.classList.add('touch-ui');
})();
