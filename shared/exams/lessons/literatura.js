// ENEM lesson for the linguagens topic "literatura": what the exam asks, core ideas, one solved question
// and common traps. Example: ENEM 2022, question 30, from api.enem.dev (official answer C).

export default {
  topic: 'literatura',
  title: 'Literatura',
  cai: 'O ENEM traz um trecho de romance, conto ou poema e pede para ligar o texto ao seu movimento literário ou ao seu contexto. Também pergunta o efeito de um recurso, como a ironia de Machado de Assis ou a denúncia social do Romance de 30. Saber as marcas de cada estilo ajuda a eliminar alternativas rápido.',
  ideias: [
    'Barroco (século XVII): contrastes, conflito entre fé e prazer. Gregório de Matos e Padre Antônio Vieira.',
    'Arcadismo (século XVIII): vida simples no campo, equilíbrio, pastores. Cláudio Manuel da Costa e Tomás Antônio Gonzaga.',
    'Romantismo (século XIX): sentimento, idealização, nacionalismo, o indígena como herói. José de Alencar, Gonçalves Dias, Castro Alves.',
    'Realismo: crítica à sociedade burguesa, ironia e análise psicológica. Machado de Assis, com Memórias Póstumas de Brás Cubas (1881).',
    'Naturalismo: o ser humano explicado pela biologia, pelo meio e pela hereditariedade. Aluísio Azevedo, com O Cortiço.',
    'Modernismo (Semana de Arte Moderna, 1922): ruptura, verso livre, língua do dia a dia. Mário de Andrade, Oswald de Andrade, Manuel Bandeira.',
    'Romance de 30: regionalismo e denúncia social, como a seca e a miséria. Graciliano Ramos, Rachel de Queiroz, Jorge Amado.',
    'Literatura contemporânea: vozes da periferia, negras e femininas. Carolina Maria de Jesus e Conceição Evaristo aparecem muito.',
  ],
  exemplo: {
    year: 2022,
    number: 30,
    enunciado:
      'A senhora manifestava-se por atos, por gestos, e sobretudo por um certo silêncio, que amargava, que esfolava. Porém desmoralizar escancaradamente o marido, não era com ela. […]\n\n' +
      'As negras receberam ordem para meter no serviço a gente do tal compadre Silveira: as cunhadas, ao fuso; os cunhados, ao campo, tratar do gado com os vaqueiros; a mulher e as irmãs, que se ocupassem da ninhada. Margarida não tivera filhos, e como os desejasse com a força de suas vontades, tratava sempre bem aos pequenitos e às mães que os estavam criando. Não era isso uma sentimentalidade cristã, uma ternura, era o egoísta e cru instinto da maternidade, obrando por mera simpatia carnal. Quanto ao pai do lote (referia-se ao Antônio), esse que fosse ajudar ao vaqueiro das bestas.\n\n' +
      'Ordens dadas, o Quinquim referendava. Cada um moralizava o outro, para moralizar-se.\n\n' +
      'PAIVA, M. O. Dona Guidinha do Poço. Rio de Janeiro: Tecnoprint, s/d\n\n' +
      'No trecho do romance naturalista, a forma como o narrador julga comportamentos e emoções das personagens femininas revela influência do pensamento',
    alternativas: {
      A: 'Capitalista, marcado pela distribuição funcional do trabalho.',
      B: 'Liberal, buscando a igualdade entre pessoas escravizadas e livres.',
      C: 'Científico, considerando o ser humano como um fenômeno biológico.',
      D: 'Religioso, fundamentado na fé e na aceitação dos dogmas do cristianismo',
      E: 'Afetivo, manifesto na determinação de acolher familiares e no respeito mútuo',
    },
    passos: [
      'O comando já dá a pista: é um romance naturalista. Ele pergunta que pensamento guia o modo como o narrador julga as mulheres.',
      'Releia o trecho chave: "Não era isso uma sentimentalidade cristã, uma ternura, era o egoísta e cru instinto da maternidade, obrando por mera simpatia carnal."',
      'O narrador recusa a explicação religiosa e a afetiva. Ele explica o desejo de ter filhos como instinto, algo do corpo.',
      'Ver o ser humano como fenômeno biológico, movido por instintos, é marca do cientificismo que inspirou o Naturalismo.',
      'D e E são justamente as explicações que o narrador recusa. A fala da divisão de tarefas, que aparece no texto, mas não explica o julgamento das emoções. B não tem apoio no trecho.',
      'Resposta: C.',
    ],
    resposta: 'C',
  },
  pegadinhas: [
    'Confundir Realismo e Naturalismo. O realista analisa a psicologia e a sociedade; o naturalista explica as pessoas pela biologia e pelo meio.',
    'Achar que todo texto antigo é romântico. Idealização indica Romantismo; crítica e ironia indicam Realismo.',
    'Ler o trecho só pelo enredo e esquecer o comando, que quase sempre pede o recurso ou a estética.',
    'Ignorar o autor e a data na referência. Eles ajudam a situar o texto no tempo.',
  ],
}
