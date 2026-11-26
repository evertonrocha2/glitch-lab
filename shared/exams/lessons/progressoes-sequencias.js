// ENEM lesson: Sequências e progressões (matematica).
// Example: ENEM 2023, questão 159 (api.enem.dev), official answer D.

export default {
  topic: 'progressoes-sequencias',
  title: 'Sequências e progressões',
  cai: 'O ENEM traz padrões que se repetem, contagens que crescem sempre o mesmo valor (PA) e populações que se multiplicam sempre pelo mesmo fator (PG). Também pede o termo de posição muito alta, como o 2 015º item de uma lista. Descobrir a regra da sequência resolve quase tudo.',
  ideias: [
    'Progressão aritmética (PA): soma sempre o mesmo valor r, a razão. Exemplo: 3, 7, 11, 15 tem r = 4.',
    'Termo geral da PA: aₙ = a₁ + (n − 1) · r.',
    'Soma dos n primeiros termos da PA: Sₙ = (a₁ + aₙ) · n ÷ 2.',
    'Progressão geométrica (PG): multiplica sempre pelo mesmo valor q, a razão. Exemplo: 2, 6, 18, 54 tem q = 3.',
    'Termo geral da PG: aₙ = a₁ · qⁿ⁻¹.',
    'Soma dos n primeiros termos da PG: Sₙ = a₁ · (qⁿ − 1) ÷ (q − 1), para q ≠ 1.',
    'Sequência que se repete em blocos: divida a posição pelo tamanho do bloco. O resto diz qual termo do bloco aparece (resto 0 é o último do bloco).',
    'Crescimento por um fator fixo a cada período é uma PG, mesmo quando o texto não usa essa palavra.',
  ],
  exemplo: {
    year: 2023,
    number: 159,
    enunciado:
      'Um agricultor é informado sobre um método de proteção para sua lavoura que consiste em inserir larvas específicas, de rápida reprodução. A reprodução dessas larvas faz com que sua população multiplique-se por 10 a cada 3 dias e, para evitar eventuais desequilíbrios, é possível cessar essa reprodução aplicando-se um produto X. O agricultor decide iniciar esse método com 100 larvas e dispõe de 5 litros do produto X, cuja aplicação recomendada é de exatamente 1 litro para cada população de 200 000 larvas. A quantidade total do produto X de que ele dispõe deverá ser aplicada de uma única vez. Quantos dias após iniciado esse método o agricultor deverá aplicar o produto X?',
    alternativas: {
      A: '2',
      B: '4',
      C: '6',
      D: '12',
      E: '18',
    },
    passos: [
      'Os 5 litros devem ser usados de uma vez, na dose de 1 litro para cada 200 000 larvas. Então a população deve ser 5 × 200 000 = 1 000 000 larvas.',
      'A população forma uma PG de razão 10, com um termo a cada 3 dias, começando em 100.',
      'Dia 0: 100. Dia 3: 1 000. Dia 6: 10 000. Dia 9: 100 000. Dia 12: 1 000 000.',
      'Pela fórmula: 100 · 10ᵏ = 1 000 000, então 10ᵏ = 10 000 e k = 4 períodos de 3 dias. São 4 × 3 = 12 dias.',
      'A resposta é a letra D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Contar períodos em vez de dias. Foram 4 multiplicações por 10, mas cada uma leva 3 dias.',
    'Tratar como PA e somar um valor fixo quando a população é multiplicada.',
    'Errar o termo geral usando n no expoente ou no fator em vez de (n − 1).',
    'Em sequências que se repetem, esquecer que resto 0 corresponde ao último termo do bloco, e não ao primeiro.',
  ],
}
