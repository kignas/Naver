let locks = 0;
let previousOverflow = '';

export function lockPageScroll(): () => void {
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('nb-scroll-lock');
  }
  locks += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      document.body.classList.remove('nb-scroll-lock');
      document.body.style.overflow = previousOverflow;
    }
  };
}
