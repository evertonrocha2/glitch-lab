// Aula ENEM de Biologia, genética e evolução (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2021, questão 132, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2021/questions/132).

export default {
  topic: 'biologia-genetica-evolucao',
  title: 'Biologia: genética e evolução',
  cai: 'Em genética, o ENEM gosta de heredogramas, cruzamentos simples, grupos sanguíneos e doenças hereditárias, quase sempre pedindo uma probabilidade ou o tipo de herança. Em evolução, as questões comparam Lamarck e Darwin, explicam a resistência a antibióticos e inseticidas ou falam de formação de novas espécies. Biotecnologia, como transgênicos, clonagem e testes de DNA, também aparece.',
  ideias: [
    'Gene é um trecho de DNA; alelos são versões do mesmo gene. Genótipo é a combinação de alelos; fenótipo é a característica que aparece.',
    '1ª lei de Mendel: cada característica depende de um par de alelos, que se separam na formação dos gametas.',
    'Cruzamento Aa x Aa: 1/4 AA, 2/4 Aa e 1/4 aa. Se a doença é recessiva, 1/4 dos filhos são afetados e 3/4 não.',
    'Herança recessiva: o afetado é aa, e pais normais podem ser portadores (Aa). Herança dominante: basta um alelo, e todo afetado tem pelo menos um dos pais afetado.',
    '2ª lei de Mendel: genes em cromossomos diferentes se distribuem de forma independente. Genes muito próximos no mesmo cromossomo tendem a ser herdados juntos (ligação gênica).',
    'Grupos sanguíneos ABO: os alelos IA e IB são codominantes e i é recessivo. O tipo O é ii.',
    'Herança ligada ao X (daltonismo, hemofilia): é mais comum em homens, que têm um só cromossomo X.',
    'Lamarck: uso e desuso e herança das características adquiridas, ideia rejeitada hoje. Darwin: variação entre os indivíduos e seleção natural dos mais adaptados.',
    'Teoria sintética: mutação e recombinação geram variabilidade, e a seleção natural escolhe. O antibiótico não cria a bactéria resistente; ele seleciona as que já eram resistentes.',
  ],
  exemplo: {
    year: 2021,
    number: 132,
    enunciado: 'A deficiência de lipase ácida lisossômica é uma doença hereditária associada a um gene do cromossomo 10. Os pais dos pacientes podem não saber que são portadores dos genes da doença até o nascimento do primeiro filho afetado. Quando ambos os progenitores são portadores, existe uma chance, em quatro, de que seu bebê possa nascer com essa doença.\n\nANDERSON, R. A. et. al. In: Situ Localization of the Genetic Locus Encoding the Lysosomal Acid Lipase/Cholesteryl Esterase (LIPA) Deficient in Wolman Disease to Chromosome 10q23.2-q23.3. Genomics, n. 1, jan, 1993 (adaptado).\n\nEssa é uma doença hereditária de caráter',
    alternativas: {
      A: 'Recessivo.',
      B: 'Dominante.',
      C: 'Codominante.',
      D: 'Poligênico.',
      E: 'Polialélico.',
    },
    passos: [
      'Os pais não têm a doença, mas podem ter um filho doente. Então eles carregam um alelo escondido: são portadores.',
      'Isso é o padrão da herança recessiva. Chame o alelo normal de A e o da doença de a. Cada pai é Aa.',
      'Cruzando Aa x Aa: AA, Aa, aA e aa. Só aa é doente, ou seja, 1 chance em 4.',
      'É exatamente a chance que o texto informa. Se a doença fosse dominante, pelo menos um dos pais teria de ser doente.',
      'Codominância, herança poligênica e polialelia não explicam esse padrão de 1 em 4 com pais normais. Resposta: letra A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Achar que, se o primeiro filho nasceu doente, os próximos serão normais. Cada gestação tem a mesma chance de 1/4.',
    'Confundir dominante com mais comum na população. Dominância fala de como o alelo se expressa, não de quantas pessoas o têm.',
    'Explicar evolução dizendo que a girafa esticou o pescoço e passou isso aos filhos. Isso é Lamarck; o ENEM espera seleção natural.',
    'Dizer que o ambiente provoca a mutação para o organismo se adaptar. A mutação é aleatória; o ambiente só seleciona.',
    'Esquecer que doença ligada ao X aparece mais em homens, já que eles não têm um segundo X para compensar.',
  ],
}
