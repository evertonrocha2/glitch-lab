// Aula ENEM de Química orgânica: funções, nomes, propriedades e reações (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2023, questão 102, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2023/questions/102).

export default {
  topic: 'quimica-organica',
  title: 'Química orgânica',
  cai: 'O ENEM cobra química orgânica a partir de remédios, alimentos, combustíveis, plásticos e aromas. As questões pedem para reconhecer funções orgânicas, dar nomes, comparar propriedades como solubilidade e ponto de ebulição, ou prever o produto de uma reação. Isomeria e polímeros também aparecem com frequência.',
  ideias: [
    'O carbono faz 4 ligações e forma cadeias. Hidrocarbonetos têm só carbono e hidrogênio e são apolares.',
    'Nomenclatura: prefixo do número de carbonos (met 1, et 2, prop 3, but 4, pent 5, hex 6) + tipo de ligação (an, en, in) + sufixo da função.',
    'Funções oxigenadas: álcool (-OH em carbono saturado, sufixo ol), aldeído (C=O na ponta da cadeia, sufixo al), cetona (C=O no meio da cadeia, sufixo ona), ácido carboxílico (-COOH, terminação oico) e éster (-COO- entre carbonos).',
    'Funções nitrogenadas: amina (-NH2) e amida (-CONH2). Aminas têm caráter básico.',
    'Oxidação de álcoois: álcool primário vira aldeído e depois ácido carboxílico; álcool secundário vira cetona; álcool terciário não se oxida em condições brandas.',
    'Saponificação: éster (óleo ou gordura) + base forte (NaOH) produz sabão e glicerol. Esterificação: ácido + álcool produz éster + água.',
    'Semelhante dissolve semelhante: grupos polares e ligações de hidrogênio aumentam a solubilidade em água e o ponto de ebulição.',
    'Isômeros têm a mesma fórmula molecular e estruturas diferentes. Isomeria óptica exige carbono quiral (4 ligantes diferentes).',
    'Polímeros são cadeias longas formadas pela união de muitos monômeros, como polietileno, PET e borracha.',
  ],
  exemplo: {
    year: 2023,
    number: 102,
    enunciado: 'As cetonas fazem parte de famílias olfativas encontradas em muitos alimentos. A molécula de hexan-3-ona é um exemplo desses compostos voláteis responsáveis pelo aroma, podendo ser obtida por processos energéticos realizados em meio ácido, na presença de oxidantes como o permanganato de potássio. Para se produzir esse composto volátil em laboratório, deve-se oxidar a molécula de',
    alternativas: {
      A: 'Hexanal.',
      B: 'Hexan-1-ol.',
      C: 'Hexan-3-ol.',
      D: 'Hex-1-en-1-ol.',
      E: 'Ácido hexanoico.',
    },
    passos: [
      'A hexan-3-ona é uma cetona: 6 carbonos (hex), só ligações simples (an) e o grupo C=O no carbono 3 (3-ona).',
      'Cetonas se formam pela oxidação de álcoois secundários, aqueles em que o -OH está num carbono ligado a outros dois carbonos.',
      'O oxidante (permanganato em meio ácido) transforma o C-OH em C=O, sem mudar a cadeia nem a posição do grupo.',
      'Então o álcool de partida tem 6 carbonos e o -OH no carbono 3: hexan-3-ol.',
      'Hexanal já é um aldeído, o hexan-1-ol é primário e daria aldeído ou ácido, e o ácido hexanoico não vira cetona. Resposta: letra C.',
    ],
    resposta: 'C',
  },
  pegadinhas: [
    'Confundir aldeído (C=O na ponta da cadeia) com cetona (C=O no meio).',
    'Achar que todo álcool oxida para cetona. O primário dá aldeído e ácido; só o secundário dá cetona.',
    'Contar errado os carbonos da cadeia principal. Ela é a maior sequência contínua de carbonos, não a linha reta do desenho.',
    'Confundir éster com éter. Éster tem C=O junto do oxigênio (-COO-); éter tem só um oxigênio entre carbonos (-O-).',
    'Pensar que isômeros são a mesma substância. Mesma fórmula molecular não quer dizer mesmas propriedades.',
  ],
}
