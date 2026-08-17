/**
 * keypad.js — Builds the calculator keypad and wires up button events
 */

const KEYPAD_ROWS = [
  [
    { label: '7',      class: 'k-num',     val: '7' },
    { label: '8',      class: 'k-num',     val: '8' },
    { label: '9',      class: 'k-num',     val: '9' },
    { label: '÷',      class: 'k-op',      val: '/' },
    { label: 'sin(',   class: 'k-fn',      val: 'sin(' },
  ],
  [
    { label: '4',      class: 'k-num',     val: '4' },
    { label: '5',      class: 'k-num',     val: '5' },
    { label: '6',      class: 'k-num',     val: '6' },
    { label: '×',      class: 'k-op',      val: '*' },
    { label: 'cos(',   class: 'k-fn',      val: 'cos(' },
  ],
  [
    { label: '1',      class: 'k-num',     val: '1' },
    { label: '2',      class: 'k-num',     val: '2' },
    { label: '3',      class: 'k-num',     val: '3' },
    { label: '−',      class: 'k-op',      val: '-' },
    { label: 'tan(',   class: 'k-fn',      val: 'tan(' },
  ],
  [
    { label: '0',      class: 'k-num',     val: '0' },
    { label: '.',      class: 'k-num',     val: '.' },
    { label: '(',      class: 'k-special', val: '(' },
    { label: ')',      class: 'k-special', val: ')' },
    { label: '^',      class: 'k-op',      val: '^' },
  ],
  [
    { label: 'x',      class: 'k-special', val: 'x' },
    { label: 'y',      class: 'k-special', val: 'y' },
    { label: 'e',      class: 'k-special', val: 'e' },
    { label: 'π',      class: 'k-special', val: 'pi' },
    { label: '+',      class: 'k-op',      val: '+' },
  ],
  [
    { label: '√(',     class: 'k-fn',      val: 'sqrt(' },
    { label: 'log(',   class: 'k-fn',      val: 'log(' },
    { label: 'ln(',    class: 'k-fn',      val: 'log(' },
    { label: 'abs(',   class: 'k-fn',      val: 'abs(' },
    { label: '!',      class: 'k-op',      val: '!' },
  ],
  [
    { label: '[[',     class: 'k-special', val: '[[' },
    { label: ']]',     class: 'k-special', val: ']]' },
    { label: ';',      class: 'k-special', val: ';' },
    { label: 'CLEAR',  class: 'k-clear',   val: '__CLEAR__' },
    { label: '⌫',      class: 'k-del',     val: '__DEL__' },
  ],
];

function buildKeypad(containerId, inputEl) {
  const container = document.getElementById(containerId);
  KEYPAD_ROWS.forEach(row => {
    row.forEach(({ label, class: cls, val }) => {
      const btn = document.createElement('button');
      btn.className = `kbtn ${cls}`;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (val === '__CLEAR__') {
          inputEl.value = '';
        } else if (val === '__DEL__') {
          inputEl.value = inputEl.value.slice(0, -1);
        } else {
          inputEl.value += val;
        }
        inputEl.dispatchEvent(new Event('input'));
        inputEl.focus();
      });
      container.appendChild(btn);
    });
  });
}
