// ENEM lesson: Geometria analítica (matematica).
// Example: ENEM 2022, questão 146 (api.enem.dev), official answer E. The plane-figure questions of
// 2019 to 2023 on api.enem.dev all come with a figure, so the example is a text-only one solved as
// two lines meeting at a point (a linear system) and then whole-number points on a third line.

export default {
  topic: 'geometria-analitica',
  title: 'Geometria analítica',
  cai: 'O ENEM coloca pontos num plano cartesiano: mapas de bairros, telas de jogos, rotas e trajetos. Pede distância entre pontos, ponto médio, equação de uma reta e o ponto onde duas retas se cruzam. Muitas vezes isso aparece disfarçado de sistema de equações com duas incógnitas.',
  ideias: [
    'Um ponto do plano é um par (x, y): x é a posição na horizontal e y na vertical.',
    'Distância entre A(x₁, y₁) e B(x₂, y₂): d = √[(x₂ − x₁)² + (y₂ − y₁)²]. É o teorema de Pitágoras.',
    'Ponto médio de AB: M = ((x₁ + x₂) ÷ 2, (y₁ + y₂) ÷ 2).',
    'Coeficiente angular (inclinação) da reta por A e B: m = (y₂ − y₁) ÷ (x₂ − x₁).',
    'Equação reduzida da reta: y = m · x + n. O n é onde a reta corta o eixo y.',
    'Retas paralelas têm o mesmo m. Retas perpendiculares têm m₁ · m₂ = −1.',
    'Toda equação do tipo a · x + b · y = c é uma reta. Resolver um sistema de duas dessas equações é achar o ponto onde as duas retas se cruzam.',
    'Circunferência de centro (a, b) e raio r: (x − a)² + (y − b)² = r².',
  ],
  exemplo: {
    year: 2022,
    number: 146,
    enunciado:
      'Um parque tem dois circuitos de tamanhos diferentes para corridas. Um corredor treina nesse parque e, no primeiro dia, inicia seu treino percorrendo 3 voltas em torno do circuito maior e 2 voltas em torno do menor, perfazendo um total de 1 800 m. Em seguida, dando continuidade a seu treino, corre mais 2 voltas em torno do circuito maior e 1 volta em torno do menor, percorrendo mais 1 100 m. No segundo dia, ele pretende percorrer 5 000 m nos circuitos do parque, fazendo um número inteiro de voltas em torno deles e de modo que o número de voltas seja o maior possível. A soma do número de voltas em torno dos dois circuitos, no segundo dia, será',
    alternativas: {
      A: '10.',
      B: '13.',
      C: '14.',
      D: '15.',
      E: '16',
    },
    passos: [
      'Chame de x o tamanho do circuito maior e de y o do menor, em metros. Cada informação vira a equação de uma reta: 3x + 2y = 1 800 e 2x + y = 1 100.',
      'O par (x, y) certo é o ponto onde as duas retas se cruzam. Da segunda equação, y = 1 100 − 2x.',
      'Substitua na primeira: 3x + 2 · (1 100 − 2x) = 1 800, então 3x + 2 200 − 4x = 1 800 e x = 400. Logo y = 1 100 − 800 = 300.',
      'No segundo dia, com a voltas no maior e b no menor: 400a + 300b = 5 000, ou seja, 4a + 3b = 50. Precisamos de pontos com a e b inteiros e não negativos nessa reta.',
      'Para ter mais voltas, use mais o circuito menor. Testando: a = 2 dá 3b = 42, b = 14 (soma 16). a = 5 dá b = 10 (soma 15). a = 8 dá b = 6 (soma 14). Com a = 0 ou 1, b não sai inteiro.',
      'O maior total possível é 2 + 14 = 16 voltas.',
      'A resposta é a letra E.',
    ],
    resposta: 'E',
  },
  pegadinhas: [
    'Trocar a ordem na fórmula da inclinação: tem que ser (y₂ − y₁) ÷ (x₂ − x₁), com os dois pontos na mesma ordem em cima e embaixo.',
    'Esquecer a raiz quadrada no fim da fórmula da distância.',
    'Achar que retas perpendiculares têm inclinações opostas (m e −m). O certo é m₁ · m₂ = −1.',
    'Resolver o sistema e parar no tamanho dos circuitos, sem voltar à pergunta, que era o total de voltas.',
  ],
}
