// ENEM lesson for the linguagens topic "gramatica-funcoes-linguagem": what the exam asks, core ideas, one solved question
// and common traps. Example: ENEM 2022, question 26, from api.enem.dev (official answer C).

export default {
  topic: 'gramatica-funcoes-linguagem',
  title: 'Gramática e funções da linguagem',
  cai: 'O ENEM quase não pede regra decorada. Ele cobra a gramática pelo sentido: o efeito de um pronome, de um conectivo ou de uma repetição no texto. As funções da linguagem também aparecem muito, e a pergunta é qual delas predomina ou onde uma delas aparece.',
  ideias: [
    'Função referencial (ou denotativa): foco no assunto, na informação. Comum em notícias e textos científicos.',
    'Função emotiva (ou expressiva): foco no emissor. Primeira pessoa, sentimentos, opiniões, exclamações.',
    'Função conativa (ou apelativa): foco no receptor. Imperativo, vocativo, segunda pessoa. Comum na publicidade.',
    'Função fática: foco no canal, em abrir ou manter o contato. Exemplos: "alô", "tá me ouvindo?", "né?".',
    'Função metalinguística: foco no código. A língua falando da própria língua, como num verbete ou num poema sobre fazer poemas.',
    'Função poética: foco na mensagem, na forma. Ritmo, rima, sonoridade, jogo de palavras.',
    'Um texto pode ter várias funções. A pergunta costuma ser qual predomina.',
    'Coesão liga as partes do texto: pronomes e sinônimos retomam termos, conectivos ligam ideias.',
    'Conectivos têm sentido: "mas" (oposição), "porque" (causa), "embora" (concessão), "portanto" (conclusão).',
  ],
  exemplo: {
    year: 2022,
    number: 26,
    enunciado:
      'Assentamento\n\n' +
      'Assentamento\nZanza daqui\nZanza pra acolá\nFim de feira, periferia afora\nA cidade não mora mais em mim\nFrancisco, Serafim\nVamos embora\nVer o capim\nVer o baobá\nVamos ver a campina quando flora\nA piracema, rios contravim\nBinho, Bel, Bia, Quim\nVamos embora\nQuando eu morrer\nCansado de guerra\nMorro de bem\nCom a minha terra:\nCana, caqui\nInhame, abóbora\nOnde só vento se semeava outrora\nAmplidão, nação, sertão sem fim\nÓ Manuel, Miguilim\nVamos embora\n\n' +
      'BUARQUE, C. As cidades. Rio de Janeiro: RCA, 1998 (fragmento).\n\n' +
      'Nesse texto, predomina a função poética da linguagem. Entretanto, a função emotiva pode ser identificada no verso:',
    alternativas: {
      A: '“Zanza pra acolá”.',
      B: '“Fim de feira, periferia afora”.',
      C: '“A cidade não mora mais em mim”.',
      D: '"Onde só vento se semeava outrora”.',
      E: '“Ó Manuel, Miguilim”.',
    },
    passos: [
      'O comando diz que a função poética predomina e pede o verso com função emotiva.',
      'Função emotiva põe o foco no emissor: o eu que fala, seus sentimentos e sua visão das coisas.',
      'Procure marcas de primeira pessoa. Em "A cidade não mora mais em mim", o pronome "mim" mostra o eu lírico falando do que sente.',
      'A, B e D descrevem movimento ou paisagem, sem expor o interior de quem fala. E é um chamamento (vocativo), que aponta para o receptor.',
      'Resposta: C.',
    ],
    resposta: 'C',
  },
  pegadinhas: [
    'Confundir função emotiva (foco em quem fala) com função conativa (foco em quem ouve).',
    'Achar que todo poema tem só a função poética. Ele pode ter traços emotivos, conativos ou metalinguísticos.',
    'Ver um vocativo, como "Ó Manuel", e marcar emotiva. Chamar alguém aponta para o receptor.',
    'Decorar o nome do conectivo e esquecer o sentido. Leia a frase e pergunte que relação ele cria.',
  ],
}
