/** Une nombres de clase ignorando valores falsos. */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}
