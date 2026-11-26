// Aula ENEM de Física, mecânica: movimento, leis de Newton, impulso e quantidade de movimento (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2019, questão 111, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2019/questions/111).

export default {
  topic: 'fisica-mecanica',
  title: 'Física: mecânica',
  cai: 'O ENEM cobra mecânica em situações do dia a dia: carros, frenagens, quedas, esportes e segurança no trânsito ou no trabalho. Quase sempre é preciso tirar os dados do texto e aplicar uma ou duas fórmulas, como velocidade média, queda livre ou impulso. Também aparecem questões conceituais sobre inércia, atrito e ação e reação.',
  ideias: [
    'Velocidade média: v = Δs / Δt. Para converter, km/h ÷ 3,6 = m/s.',
    'Movimento uniformemente variado: v = v0 + a · t e s = s0 + v0 · t + a · t² / 2.',
    'Equação de Torricelli: v² = v0² + 2 · a · Δs. Na queda livre a partir do repouso, v = √(2 · g · h).',
    '1ª lei de Newton (inércia): sem força resultante, o corpo fica em repouso ou segue em linha reta com velocidade constante.',
    '2ª lei de Newton: F = m · a. Força em newtons (N), massa em kg, aceleração em m/s².',
    '3ª lei de Newton: ação e reação têm a mesma intensidade, a mesma direção e sentidos opostos, e agem em corpos diferentes.',
    'Peso: P = m · g, com g = 10 m/s² nas questões do ENEM.',
    'Quantidade de movimento: Q = m · v (kg · m/s). Impulso: I = F · Δt = ΔQ.',
    'Para a mesma variação de Q, quanto maior o tempo do impacto, menor a força média. É por isso que capacete, airbag e colchão protegem.',
  ],
  exemplo: {
    year: 2019,
    number: 111,
    enunciado: 'Em qualquer obra de construção civil é fundamental a utilização de equipamentos de proteção individual, tal como capacetes. Por exemplo, a queda livre de um tijolo de massa 2,5kg de uma altura de 5m, cujo impacto contra um capacete pode durar até 0,5s, resulta em uma força impulsiva média maior do que o peso do tijolo. Suponha que a aceleração gravitacional seja 10 m s–2 e que o efeito de resistência do ar seja desprezível.\n\nA força impulsiva média gerada por esse impacto equivale ao peso de quantos tijolos iguais?',
    alternativas: {
      A: '2',
      B: '5',
      C: '10',
      D: '20',
      E: '50',
    },
    passos: [
      'Primeiro, ache a velocidade do tijolo ao chegar no capacete. Na queda livre: v = √(2 · g · h) = √(2 · 10 · 5) = √100 = 10 m/s.',
      'A quantidade de movimento antes do impacto é Q = m · v = 2,5 · 10 = 25 kg · m/s. Depois do impacto o tijolo para, então ΔQ = 25 kg · m/s.',
      'Pelo teorema do impulso, F · Δt = ΔQ. Assim, F = 25 / 0,5 = 50 N.',
      'O peso de um tijolo é P = m · g = 2,5 · 10 = 25 N.',
      'Dividindo: 50 / 25 = 2. A força média vale o peso de 2 tijolos. Resposta: letra A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Esquecer de converter km/h para m/s (divida por 3,6) antes de usar as fórmulas.',
    'Confundir massa (kg) com peso (N). Peso é uma força: P = m · g.',
    'Achar que ação e reação se anulam. Elas agem em corpos diferentes, então não se cancelam.',
    'Pensar que um corpo em movimento precisa de força para continuar andando. Sem atrito, ele segue sozinho (inércia).',
    'Usar a altura direto na fórmula do impulso. Primeiro calcule a velocidade, depois Q = m · v.',
  ],
}
