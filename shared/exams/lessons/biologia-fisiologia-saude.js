// Aula ENEM de Biologia, corpo humano e saúde (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2021, questão 114, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2021/questions/114).

export default {
  topic: 'biologia-fisiologia-saude',
  title: 'Biologia: corpo humano e saúde',
  cai: 'O ENEM cobra o corpo humano ligado à saúde: doenças, vacinas, hormônios, exames e hábitos. As questões pedem para entender como um sistema funciona, como o nervoso, o circulatório ou o imunológico, ou como uma doença é transmitida e prevenida. Doenças comuns no Brasil, como dengue, esquistossomose e doença de Chagas, aparecem com frequência.',
  ideias: [
    'Sistema nervoso central: encéfalo e medula espinal. O cerebelo cuida do equilíbrio e da coordenação; o hipotálamo controla temperatura, fome e sede.',
    'Arco reflexo: estímulo, neurônio sensitivo, medula espinal, neurônio motor e resposta. O reflexo é rápido porque não depende do cérebro para acontecer.',
    'A circulação humana é fechada e dupla: o lado direito do coração manda sangue para os pulmões e o esquerdo, para o corpo. As hemácias levam oxigênio preso à hemoglobina.',
    'Digestão: começa na boca (amilase da saliva), segue no estômago (pepsina, meio ácido) e termina no intestino delgado, onde os nutrientes são absorvidos.',
    'Imunidade: vacina é imunização ativa (o corpo produz anticorpos e células de memória, efeito duradouro). Soro é imunização passiva (anticorpos prontos, efeito rápido e curto).',
    'Hormônios: a insulina baixa a glicose no sangue e o glucagon a aumenta. Estrógeno e progesterona regulam o ciclo menstrual.',
    'Os rins filtram o sangue e formam a urina, eliminando ureia e controlando a água e os sais do corpo.',
    'Doenças e transmissão: dengue, zika e chikungunya (mosquito Aedes aegypti), malária (mosquito Anopheles), doença de Chagas (barbeiro), esquistossomose (larvas liberadas por caramujos na água).',
    'Antibiótico age contra bactérias, não contra vírus. O uso errado seleciona bactérias resistentes.',
  ],
  exemplo: {
    year: 2021,
    number: 114,
    enunciado: 'Um dos exames clínicos mais tradicionais para medir a capacidade reflexa dos indivíduos é o exame do reflexo patelar. Esse exame consiste na estimulação da patela, um pequeno osso localizado na parte anterior da articulação do joelho, com um pequeno martelo. A resposta reflexa ao estímulo é caracterizada pelo levantamento da perna em que o estímulo foi aplicado.\n\nQual região específica do sistema nervoso coordena essa resposta?',
    alternativas: {
      A: 'Ponte.',
      B: 'Medula.',
      C: 'Cerebelo.',
      D: 'Hipotálamo.',
      E: 'Neuro-hipófise.',
    },
    passos: [
      'O reflexo patelar é um arco reflexo: a batida no joelho estica o tendão, um neurônio sensitivo leva o sinal e um neurônio motor faz a perna levantar.',
      'A ligação entre o neurônio sensitivo e o motor acontece na medula espinal, sem precisar passar pelo encéfalo.',
      'Ponte, cerebelo e hipotálamo ficam no encéfalo e cuidam de outras funções. A neuro-hipófise libera hormônios e não coordena reflexos.',
      'Por isso o médico usa esse exame para avaliar a medula e os nervos da perna. Resposta: letra B.',
    ],
    resposta: 'B',
  },
  pegadinhas: [
    'Achar que todo reflexo é comandado pelo cérebro. Reflexos simples, como o patelar, são coordenados pela medula.',
    'Confundir vacina (prevenção, gera memória) com soro (tratamento imediato, sem memória).',
    'Tratar gripe ou covid com antibiótico. Antibiótico não age em vírus.',
    'Achar que o mosquito Aedes causa a dengue. Quem causa é o vírus; o mosquito é o vetor.',
    'Dizer que veia sempre leva sangue pobre em oxigênio. As veias pulmonares levam sangue oxigenado ao coração.',
  ],
}
