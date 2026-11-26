// ENEM lesson: Geometria plana (matematica).
// Example: ENEM 2019, questão 142 (api.enem.dev), official answer E.

export default {
  topic: 'geometria-plana',
  title: 'Geometria plana',
  cai: 'O ENEM pede áreas e perímetros de terrenos, pisos, placas e jardins, muitas vezes com figuras compostas. Círculo, triângulo, retângulo e trapézio são os mais cobrados, junto com semelhança de triângulos e o teorema de Pitágoras. Fique atento quando o texto dá o diâmetro e a fórmula pede o raio.',
  ideias: [
    'Retângulo: A = base × altura. Quadrado: A = lado². Perímetro é a soma de todos os lados.',
    'Triângulo: A = base × altura ÷ 2. Triângulo equilátero de lado L: A = L² · √3 ÷ 4.',
    'Trapézio: A = (base maior + base menor) × altura ÷ 2. Losango: A = diagonal maior × diagonal menor ÷ 2.',
    'Círculo de raio r: A = π · r² e comprimento da circunferência C = 2 · π · r. O raio é metade do diâmetro.',
    'Coroa circular (o anel entre dois círculos): A = π · R² − π · r².',
    'Teorema de Pitágoras no triângulo retângulo: a² = b² + c², em que a é a hipotenusa (lado oposto ao ângulo reto).',
    'Triângulos semelhantes têm ângulos iguais e lados proporcionais. Se os lados dobram, a área fica 4 vezes maior.',
    'Soma dos ângulos internos de um triângulo: 180°. De um polígono de n lados: (n − 2) · 180°.',
    'Figura composta: divida em partes conhecidas, calcule cada área e some (ou tire o buraco).',
  ],
  exemplo: {
    year: 2019,
    number: 142,
    enunciado:
      'Em um condomínio, uma área pavimentada, que tem a forma de um círculo com diâmetro medindo 6m, é cercado por grama. A administração do condomínio deseja ampliar essa área, mantendo seu formato circular, e aumentando, em 8m, o diâmetro dessa região, mantendo o revestimento da parte já existente. O condomínio dispõe, em estoque, de material suficiente para pavimentar mais 100 m² de área. O síndico do condomínio irá avaliar se esse material disponível será suficiente para pavimentar a região a ser ampliada. Utilize 3 como aproximação para π. A conclusão correta a que o síndico deverá chegar, considerando a nova área a ser pavimentada, é a de que o material disponível em estoque:',
    alternativas: {
      A: 'Será suficiente, pois a área da nova região a ser pavimentada mede 21 m².',
      B: 'Será suficiente, pois a área da nova região a ser pavimentada mede 24 m².',
      C: 'Será suficiente, pois a área da nova região a ser pavimentada mede 48 m².',
      D: 'Não será suficiente, pois a área da nova região a ser pavimentada mede 108 m².',
      E: 'Não será suficiente, pois a área da nova região a ser pavimentada mede 120 m².',
    },
    passos: [
      'Círculo atual: diâmetro 6 m, então raio 3 m. Área = 3 · 3² = 27 m².',
      'O diâmetro aumenta 8 m: passa a 6 + 8 = 14 m. O novo raio é 7 m.',
      'Área do círculo novo = 3 · 7² = 3 · 49 = 147 m².',
      'Só a parte nova precisa de material, porque o revestimento antigo fica. É a coroa circular: 147 − 27 = 120 m².',
      'Como 120 m² é mais que os 100 m² do estoque, o material não será suficiente.',
      'A resposta é a letra E.',
    ],
    resposta: 'E',
  },
  pegadinhas: [
    'Usar o diâmetro no lugar do raio na fórmula π · r².',
    'Somar 8 m ao raio quando o texto diz que o diâmetro aumenta 8 m. O raio aumenta só 4 m.',
    'Calcular a área do círculo inteiro novo (147 m²) e esquecer de tirar a parte que já estava pavimentada.',
    'Achar que dobrar os lados dobra a área. A área cresce com o quadrado da escala.',
  ],
}
