// ENEM lesson for the linguagens topic "interpretacao-texto": what the exam asks, core ideas, one solved question
// and common traps. Example: ENEM 2023, question 11, from api.enem.dev (official answer D).

export default {
  topic: 'interpretacao-texto',
  title: 'Interpretação de texto',
  cai: 'É o tema que mais aparece na prova de Linguagens. O ENEM traz um texto curto, como notícia, artigo, crônica ou campanha, e pergunta a ideia central, o objetivo do autor ou uma informação implícita. A resposta certa sempre se apoia no texto, e não na sua opinião sobre o assunto.',
  ideias: [
    'Tema é o assunto geral. Tese é a opinião que o autor defende sobre esse assunto.',
    'Objetivo (ou finalidade) é o que o texto quer causar no leitor: informar, convencer, alertar, divertir, ensinar.',
    'Informação explícita está escrita no texto. Informação implícita precisa ser deduzida a partir de pistas.',
    'Inferir é tirar uma conclusão que o texto autoriza, sem inventar nada que ele não sustente.',
    'Leia primeiro o comando da questão. Ele diz o que procurar: objetivo, tese, efeito de sentido ou recurso.',
    'Fonte, título e data ajudam a entender o gênero e o contexto em que o texto foi publicado.',
    'Conectivos mostram a lógica do texto: "mas" e "porém" opõem, "porque" explica, "portanto" conclui.',
    'A alternativa certa vale para o texto inteiro. A errada costuma pegar só um detalhe ou exagerar.',
  ],
  exemplo: {
    year: 2023,
    number: 11,
    enunciado:
      'Maio foi colorido de amarelo, e o foi porque mundialmente amarelo é a cor convencionada para as advertências. No trânsito, essas advertências têm sido fatais. A estimativa, caso nada seja feito, é a de que se atinjam assustadoras 2,4 milhões de mortes no trânsito em 2030 em todo o mundo.\nA pressa constante, o sentimento de invencibilidade, a certeza de invulnerabilidade, a necessidade de poder, a falta de civilidade, a certeza de impunidade, a ausência de solidariedade, a inexistência de compaixão e o desrespeito por si próprio são circunstâncias reais que, não raro, concorrem para o comportamento violento no trânsito.\nO Maio Amarelo, que preconiza a atenção pela vida, é uma das iniciativas nesse sentido. E é precisamente a atenção pela vida que está esquecida. Essa atenção, por certo, requer menos pressa, mais civilidade, limites assegurados, consciência de vulnerabilidade, solidariedade, compaixão e respeito por si e pelo outro. Reafirmar e praticar esses princípios e valores talvez seja um caminho mais seguro e menos violento, que garanta a vida e não celebre a morte.\n\n' +
      'Disponível em: http://portaldotransito.com.br. Acesso em: 11 dez. 2018 (adaptado).\n\n' +
      'Considerando os procedimentos argumentativos utilizados, infere-se que o objetivo desse texto é',
    alternativas: {
      A: 'Enumerar as causas determinantes da violência no trânsito.',
      B: 'Contextualizar a campanha de advertência no cenário mundial.',
      C: 'Divulgar dados numéricos alarmantes sobre acidentes de trânsito.',
      D: 'Sensibilizar o público para a importância de uma direção responsável.',
      E: 'Restringir os problemas da violência no trânsito a aspectos emocionais.',
    },
    passos: [
      'Leia o comando: ele pede o objetivo do texto, a partir dos procedimentos argumentativos.',
      'O texto abre com um dado alarmante (2,4 milhões de mortes no trânsito em 2030) e lista atitudes que levam à violência no trânsito.',
      'No fim, o autor apresenta o Maio Amarelo e defende valores: menos pressa, civilidade, solidariedade, respeito por si e pelo outro.',
      'Dados, causas e valores servem a um fim maior: fazer o leitor mudar de atitude ao dirigir. Isso é sensibilizar.',
      'A, B e C descrevem partes do texto (as causas, a campanha, os números), não o objetivo do todo. E restringe o problema às emoções, o que o texto não faz.',
      'Resposta: D, sensibilizar o público para a importância de uma direção responsável.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Escolher a alternativa que descreve um trecho do texto, e não o texto inteiro.',
    'Responder com a sua opinião sobre o tema em vez do que o texto diz.',
    'Cair em palavras absolutas como "sempre", "nunca", "apenas" e "restringir", que costumam exagerar o texto.',
    'Confundir o assunto do texto com o objetivo dele.',
  ],
}
