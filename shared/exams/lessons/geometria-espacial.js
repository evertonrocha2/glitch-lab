// ENEM lesson: Geometria espacial (matematica).
// Example: ENEM 2022, questão 174 (api.enem.dev), official answer D.

export default {
  topic: 'geometria-espacial',
  title: 'Geometria espacial',
  cai: 'O ENEM pede volumes de caixas-d’água, piscinas, embalagens e peças, e também planificações e vistas de sólidos. Uma questão muito comum derrete ou reaproveita um sólido para fazer outros, e aí basta igualar os volumes. Saber as fórmulas de prisma, cilindro, cone, pirâmide e esfera resolve a maior parte.',
  ideias: [
    'Paralelepípedo (bloco retangular): V = comprimento × largura × altura. Cubo de aresta a: V = a³.',
    'Prisma e cilindro: V = área da base × altura. Cilindro de raio r e altura h: V = π · r² · h.',
    'Pirâmide e cone: V = área da base × altura ÷ 3. Cone: V = π · r² · h ÷ 3.',
    'Esfera de raio r: V = 4 · π · r³ ÷ 3 e área da superfície A = 4 · π · r².',
    'Volume em litros: 1 dm³ = 1 L e 1 m³ = 1 000 L.',
    'Quando um sólido vira outros, sem perda: quantidade = volume do original ÷ volume de cada novo.',
    'Se todas as medidas são multiplicadas por k, o volume é multiplicado por k³. Dobrar o diâmetro de uma esfera multiplica o volume por 8.',
    'Relação de Euler para poliedros convexos: V − A + F = 2 (vértices, arestas e faces).',
  ],
  exemplo: {
    year: 2022,
    number: 174,
    enunciado:
      'Peças metálicas de aeronaves abandonadas em aeroportos serão recicladas. Uma dessas peças é maciça e tem o formato cilíndrico, com a medida do raio da base igual a 4 cm e a da altura igual a 50 cm. Ela será derretida, e o volume de metal resultante será utilizado para a fabricação de esferas maciças com diâmetro de 1 cm, a serem usadas para confeccionar rolamentos. Para estimar a quantidade de esferas que poderão ser produzidas a partir de cada uma das peças cilíndricas, admite-se que não ocorre perda de material durante o processo de derretimento. Quantas dessas esferas poderão ser obtidas a partir de cada peça cilíndrica?',
    alternativas: {
      A: '800',
      B: '1200',
      C: '2400',
      D: '4800',
      E: '6400',
    },
    passos: [
      'Volume do cilindro: V = π · r² · h = π · 4² · 50 = π · 16 · 50 = 800π cm³.',
      'Cada esfera tem diâmetro 1 cm, então raio 0,5 cm.',
      'Volume de uma esfera: 4 · π · (0,5)³ ÷ 3 = 4 · π · 0,125 ÷ 3 = 0,5π ÷ 3 = π/6 cm³.',
      'Número de esferas = 800π ÷ (π/6) = 800 × 6 = 4 800. O π se cancela, não precisa aproximar.',
      'A resposta é a letra D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Usar o diâmetro da esfera (1 cm) como raio. O volume sairia 8 vezes maior e a resposta, 600, nem estaria nas alternativas.',
    'Esquecer de dividir por 3 no volume do cone, da pirâmide ou da esfera.',
    'Achar que dobrar as medidas dobra o volume. O volume vai a 8 vezes.',
    'Confundir área da superfície (quanto material cobre o sólido) com volume (quanto cabe dentro).',
  ],
}
