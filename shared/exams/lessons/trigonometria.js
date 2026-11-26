// ENEM lesson: Trigonometria (matematica).
// Example: ENEM 2022, questão 165 (api.enem.dev), official answer A. Every trigonometry question of
// 2019 to 2023 on api.enem.dev comes with a figure, so the example is a text-only question on periods
// (a full turn and how long it takes), the core idea behind the periodic functions the ENEM asks.

export default {
  topic: 'trigonometria',
  title: 'Trigonometria',
  cai: 'O ENEM usa trigonometria de dois jeitos. No triângulo retângulo, pede alturas, rampas e distâncias com seno, cosseno e tangente. Nas funções periódicas, descreve marés, roda-gigante, pressão do sangue ou temperatura ao longo do dia e pergunta máximo, mínimo e período.',
  ideias: [
    'No triângulo retângulo, para um ângulo agudo θ: sen θ = cateto oposto ÷ hipotenusa, cos θ = cateto adjacente ÷ hipotenusa e tg θ = cateto oposto ÷ cateto adjacente.',
    'Valores notáveis: sen 30° = 1/2, cos 30° = √3/2; sen 45° = cos 45° = √2/2; sen 60° = √3/2, cos 60° = 1/2; tg 45° = 1.',
    'Relação fundamental: sen² θ + cos² θ = 1.',
    'Uma volta completa tem 360°, que é o mesmo que 2π radianos. Então 180° = π rad.',
    'Seno e cosseno de qualquer ângulo ficam sempre entre −1 e 1.',
    'Em f(t) = a + b · sen(c · t) ou a + b · cos(c · t): o valor máximo é a + |b| e o mínimo é a − |b|.',
    'O período (tempo de um ciclo completo) dessas funções é 2π ÷ |c|. Depois de um período, tudo se repete.',
    'Para achar o máximo de uma função periódica, procure quando o seno ou o cosseno vale 1. Para o mínimo, quando vale −1.',
  ],
  exemplo: {
    year: 2022,
    number: 165,
    enunciado:
      'Definem-se o dia e o ano de um planeta de um sistema solar como sendo, respectivamente, o tempo que o planeta leva para dar 1 volta completa em torno de seu próprio eixo de rotação e o tempo para dar 1 volta completa em torno de seu Sol. Suponha que exista um planeta Z, em algum sistema solar, onde um dia corresponda a 73 dias terrestres e que 2 de seus anos correspondam a 1 ano terrestre. Considere que 1 ano terrestre tem 365 de seus dias. No planeta Z, seu ano corresponderia a quantos de seus dias?',
    alternativas: {
      A: '2,5',
      B: '10,0',
      C: '730,0',
      D: '13 322,5',
      E: '53 290,0',
    },
    passos: [
      'Dia e ano são períodos: o tempo de uma volta completa (360°) em dois movimentos diferentes. Para comparar, use a mesma unidade: dias da Terra.',
      'O ano de Z: 2 anos de Z valem 1 ano da Terra, ou seja, 365 dias terrestres. Então 1 ano de Z = 365 ÷ 2 = 182,5 dias terrestres.',
      'O dia de Z vale 73 dias terrestres.',
      'Quantos dias de Z cabem em um ano de Z: 182,5 ÷ 73 = 2,5.',
      'Ou seja, enquanto Z dá uma volta no seu Sol, ele gira 2,5 vezes no próprio eixo (2,5 × 360° = 900°).',
      'A resposta é a letra A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Trocar cateto oposto e cateto adjacente. Olhe sempre de qual ângulo você está falando.',
    'Usar o maior lado como cateto. A hipotenusa é sempre o lado oposto ao ângulo reto e é o maior lado.',
    'Misturar graus e radianos na mesma conta. Lembre que π rad = 180°.',
    'Achar que o máximo de a + b · sen(t) é a + b mesmo quando b é negativo. O máximo é a + |b|.',
    'Comparar períodos em unidades diferentes, como dias de um planeta com dias de outro, sem converter antes.',
  ],
}
