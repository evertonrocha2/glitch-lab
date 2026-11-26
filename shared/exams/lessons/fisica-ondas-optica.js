// Aula ENEM de Física, ondas, som e óptica (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2020, questão 114, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2020/questions/114).

export default {
  topic: 'fisica-ondas-optica',
  title: 'Física: ondas, som e óptica',
  cai: 'O ENEM cobra ondas e óptica com fenômenos do cotidiano: eco, instrumentos musicais, fones com cancelamento de ruído, arco-íris, lentes, óculos e fibra óptica. As questões pedem para reconhecer o fenômeno (reflexão, refração, difração, interferência, ressonância) ou usar v = λ · f. Tubos sonoros e cordas aparecem em contas de frequência.',
  ideias: [
    'Equação fundamental: v = λ · f. Velocidade em m/s, comprimento de onda em m, frequência em hertz (Hz).',
    'Período e frequência: T = 1 / f.',
    'Som é onda mecânica e longitudinal: precisa de um meio material e não se propaga no vácuo. No ar, v ≈ 340 m/s.',
    'Luz é onda eletromagnética e transversal: viaja no vácuo a c = 3 · 10⁸ m/s.',
    'Reflexão: a onda volta ao meio de origem (eco, espelho). Refração: a onda muda de meio e de velocidade, e a frequência não muda.',
    'Difração: a onda contorna obstáculos ou fendas de tamanho parecido com o seu comprimento de onda. Interferência: ondas se somam (construtiva) ou se anulam (destrutiva).',
    'Ressonância: um corpo vibra com amplitude máxima quando recebe energia na sua frequência natural.',
    'Tubo fechado numa ponta: só harmônicos ímpares, f = n · v / (4 · L), com n = 1, 3, 5... Tubo aberto nas duas pontas: f = n · v / (2 · L), com n = 1, 2, 3...',
    'Lente convergente corrige hipermetropia; lente divergente corrige miopia.',
    'Altura do som depende da frequência (grave ou agudo); intensidade depende da amplitude (forte ou fraco); timbre diferencia instrumentos tocando a mesma nota.',
  ],
  exemplo: {
    year: 2020,
    number: 114,
    enunciado: 'Dois engenheiros estão verificando se uma cavidade perfurada no solo está de acordo com o planejamento de uma obra, cuja profundidade requerida é de 30 m. O teste é feito por um dispositivo denominado oscilador de áudio de frequência variável, que permite relacionar a profundidade com os valores da frequência de duas ressonâncias consecutivas, assim como em um tubo sonoro fechado. A menor frequência de ressonância que o aparelho mediu foi 135 Hz. Considere que a velocidade do som dentro da cavidade perfurada é de 360 m s–1.\n\nSe a profundidade estiver de acordo com o projeto, qual será o valor da próxima frequência de ressonância que será medida?',
    alternativas: {
      A: '137 Hz.',
      B: '138 Hz.',
      C: '141 Hz.',
      D: '144 Hz',
      E: '159 Hz',
    },
    passos: [
      'O texto diz que a cavidade funciona como um tubo sonoro fechado: aberta em cima e fechada no fundo.',
      'Num tubo fechado só existem harmônicos ímpares: f = n · v / (4 · L), com n = 1, 3, 5...',
      'Com a profundidade do projeto, L = 30 m. Então v / (4 · L) = 360 / 120 = 3 Hz.',
      'As ressonâncias são múltiplos ímpares de 3 Hz. A menor medida foi 135 Hz = 45 · 3 Hz, ou seja, n = 45, que é ímpar e confere.',
      'A próxima ressonância é o próximo ímpar, n = 47: f = 47 · 3 = 141 Hz.',
      'Atalho: num tubo fechado, ressonâncias consecutivas diferem de 2 · v / (4 · L) = 6 Hz. 135 + 6 = 141 Hz. Resposta: letra C.',
    ],
    resposta: 'C',
  },
  pegadinhas: [
    'Achar que a frequência muda na refração. Mudam a velocidade e o comprimento de onda; a frequência é a da fonte.',
    'Dizer que o som viaja no vácuo. Ele precisa de um meio material.',
    'Confundir som alto (intensidade) com som agudo (frequência alta).',
    'Usar a fórmula do tubo aberto num tubo fechado. No fechado, só harmônicos ímpares e o denominador é 4 · L.',
    'Trocar as lentes: miopia se corrige com lente divergente, hipermetropia com convergente.',
  ],
}
