// ENEM lesson for the linguagens topic "tecnologias-comunicacao": what the exam asks, core ideas, one solved question
// and common traps. Example: ENEM 2019, question 18, from api.enem.dev (official answer A).

export default {
  topic: 'tecnologias-comunicacao',
  title: 'Tecnologias da informação e comunicação',
  cai: 'O ENEM pergunta como a internet e as novas tecnologias mudam o jeito de ler, escrever, aprender e se relacionar. Os textos falam de redes sociais, notícias falsas, privacidade, robôs e acesso à informação. A banca costuma valorizar o uso crítico da tecnologia e a democratização do conhecimento.',
  ideias: [
    'TICs (Tecnologias da Informação e Comunicação) são os meios digitais de produzir e circular informação: internet, celular, redes sociais.',
    'Hipertexto é um texto com links que levam a outros textos. A leitura deixa de ser só linear.',
    'Na internet, qualquer pessoa pode publicar. Isso amplia as vozes, mas exige checar as fontes.',
    'Fake news são notícias falsas feitas para enganar. Contas falsas e robôs ajudam a espalhar desinformação.',
    'Algoritmos escolhem o que cada usuário vê e podem criar bolhas de opinião.',
    'Privacidade: dados pessoais expostos ou coletados podem ser usados sem controle do dono. No Brasil, a LGPD protege esses dados.',
    'Software livre e conteúdos abertos tornam o conhecimento coletivo e de acesso amplo.',
    'Exclusão digital: nem todo mundo tem acesso à internet ou sabe usá-la, o que reforça desigualdades.',
  ],
  exemplo: {
    year: 2019,
    number: 18,
    enunciado:
      'O que é software livre\nSoftware livre é qualquer programa de computador construído de forma colaborativa, via internet, por uma comunidade internacional de desenvolvedores independentes. São centenas de milhares de hackers, que negam sua associação com os “violadores de segurança”. Esses desenvolvedores de software se recusam a reconhecer o significado pejorativo do termo e continuam usando a palavra hacker para indicar “alguém que ama programar e que gosta de ser hábil e engenhoso”. Além disso, esses programas são entregues à comunidade com o código fonte aberto e disponível, permitindo que a ideia original possa ser aperfeiçoada e devolvida novamente à comunidade. Nos programas convencionais, o código de programação é secreto e de propriedade da empresa que o desenvolveu, sendo quase impossível decifrar a programação.\nO que está em jogo é o controle da inovação tecnológica. Software livre é uma questão de liberdade de expressão e não apenas uma relação econômica. Hoje existem milhares de programas alternativos construídos dessa forma e uma comunidade de usuários com milhões de membros no mundo.\nBRANCO, M. Software livre e desenvolvimento social e econômico. In: CASTELLS, M.; CARDOSO, G. (Org). A sociedade em rede: do conhecimento à ação política. Lisboa: Imprensa Nacional, 2005 (adaptado).\n\n' +
      'A criação de softwares livres contribui para a produção do conhecimento na sociedade porque',
    alternativas: {
      A: 'Democratiza o acesso a produtos construídos coletivamente.',
      B: 'Complexifica os sistemas operacionais disponíveis no mercado.',
      C: 'Qualifica um maior número de pessoas para o uso de tecnologias.',
      D: 'Possibilita a coleta de dados confidenciais para seus desenvolvedores.',
      E: 'Insere profissionalmente os hackers na área de inovação tecnológica.',
    },
    passos: [
      'O texto explica que o software livre é feito de forma colaborativa, por uma comunidade, com o código aberto.',
      'Qualquer pessoa pode ver, melhorar e devolver o programa à comunidade. No software convencional, o código é secreto.',
      'O comando pergunta por que isso ajuda a produzir conhecimento na sociedade.',
      'Se o produto é coletivo e aberto, o acesso a ele deixa de ser restrito. Isso é democratizar.',
      'B, D e E não têm apoio no texto. C fala em qualificar pessoas, algo que o texto não afirma.',
      'Resposta: A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Tratar a tecnologia como totalmente boa ou totalmente ruim. O ENEM pede um olhar equilibrado e crítico.',
    'Confundir hacker com criminoso. No texto do software livre, hacker é quem ama programar.',
    'Marcar uma alternativa verdadeira no mundo real, mas que o texto não diz.',
    'Esquecer a exclusão digital: o acesso à tecnologia não é igual para todos.',
  ],
}
