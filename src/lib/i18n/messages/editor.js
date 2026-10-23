// The code editor (gym fixes, the investigate form): its shortcut list. Each row is
// [key, English, Brazilian Portuguese], so both languages sit side by side.
const ROWS = [
  ['editor.keys.title', 'Shortcuts', 'Atalhos'],
  ['editor.keys.list', 'Editor shortcuts', 'Atalhos do editor'],
  ['editor.keys.trap', 'Tab indents here. Press Esc, then Tab, to leave the editor.', 'Aqui o Tab indenta. Aperte Esc e depois Tab para sair do editor.'],
  ['editor.keys.indent', 'Indent, outdent', 'Indentar, desindentar'],
  ['editor.keys.newline', 'New line, keeps the indent', 'Nova linha, mantém a indentação'],
  ['editor.keys.lines', 'Line below, line above', 'Linha abaixo, linha acima'],
  ['editor.keys.comment', 'Comment or uncomment', 'Comentar ou descomentar'],
  ['editor.keys.move', 'Move the line', 'Mover a linha'],
  ['editor.keys.copy', 'Copy the line', 'Copiar a linha'],
  ['editor.keys.delete', 'Delete the line', 'Apagar a linha'],
  ['editor.keys.undo', 'Undo', 'Desfazer'],
  ['editor.keys.leave', 'Leave the editor', 'Sair do editor'],
  ['editor.keys.then', 'then', 'depois'],
  ['editor.keys.pairs', 'Brackets and quotes close themselves.', 'Parênteses, colchetes e aspas fecham sozinhos.'],
  ['editor.keys.up', 'Up', 'Cima'],
  ['editor.keys.down', 'Down', 'Baixo'],
]

export default {
  en: Object.fromEntries(ROWS.map(([key, en]) => [key, en])),
  'pt-BR': Object.fromEntries(ROWS.map(([key, , pt]) => [key, pt])),
}
