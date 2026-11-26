// ENEM lesson for the linguagens topic "generos-textuais": what the exam asks, core ideas, one solved question
// and common traps. Example: ENEM 2022, question 16, from api.enem.dev (official answer E).

export default {
  topic: 'generos-textuais',
  title: 'Gêneros textuais',
  cai: 'O ENEM mostra um texto e pede para reconhecer o gênero e a função social dele. Muitas vezes o texto mistura traços de gêneros diferentes, e você precisa achar o que predomina. A pergunta típica é qual função social o texto cumpre ou o que caracteriza aquele gênero.',
  ideias: [
    'Gênero textual é a forma que um texto assume para cumprir uma função social: notícia, resenha, crônica, receita, anúncio, carta, verbete.',
    'Tipo textual é o modo de organizar o texto: narração, descrição, argumentação, exposição e injunção.',
    'Um gênero pode misturar tipos. Uma resenha narra parte da história, mas o que a define é a avaliação.',
    'Notícia: informa um fato recente, em terceira pessoa e com linguagem objetiva. Responde o quê, quem, quando, onde, como e por quê.',
    'Reportagem: aprofunda um tema, com dados, entrevistas e mais espaço que a notícia.',
    'Resenha crítica: resume e avalia uma obra (filme, livro, show), com a opinião de quem escreve.',
    'Crônica: texto curto sobre o cotidiano, em tom leve e muitas vezes pessoal.',
    'Artigo de opinião: defende uma tese com argumentos e é assinado. O editorial também opina, mas fala em nome do próprio jornal.',
    'Textos injuntivos (receita, manual, bula) orientam o leitor, com verbos no imperativo.',
  ],
  exemplo: {
    year: 2022,
    number: 16,
    enunciado:
      'Ela era linda. Gostava de dançar, fazia teatro em São Paulo e sonhava ser atriz em Hollywood. Tinha 13 anos quando ganhou uma câmera de vídeo – e uma irmã. As duas se tornaram suas companheiras de experimentações. Adolescente, Elena vivia a criar filminhos e se empenhava em dirigir a pequena Petra nas cenas que inventava. Era exigente com a irmã. E acreditava no potencial da menina para satisfazer seus arroubos de diretora precoce. Por cinco anos, integrou algumas das melhores companhias paulistanas de teatro e participou de preleções para filmes e trabalhos na TV. Nunca foi chamada. No início de 1990, Elena tinha 20 anos quando se mudou para Nova York para cursar artes cênicas e batalhar uma chance no mercado americano. Deslocada, ansiosa, frustrada após alguns testes de elenco malsucedidos, decepcionada com a ausência de reconhecimento e vitimada por uma depressão que se agravava com a falta de perspectivas, Elena pôs fim à vida no segundo semestre. Petra tinha 7 anos. Vinte anos depois, é ela, a irmã caçula, que volta a Nova York para percorrer os últimos passos da irmã, vasculhar seus arquivos e transformar suas memórias em imagem e poesia.\n\n' +
      'Elena é um filme sobre a irmã que parte e sobre a irmã que fica. É um filme sobre a busca, a perda, a saudade, mas também sobre o encontro, o legado, a memória. Um filme sobre a Elena de Petra e sobre a Petra de Elena, sobre o que ficou de uma na outra e, essencialmente, um filme sobre a delicadeza.\n\n' +
      'VANUCHI, C. Época, 19 out. 2012 (adaptado)\n\n' +
      'O texto é exemplar de um gênero discursivo que cumpre a função social de',
    alternativas: {
      A: 'Narrar, por meio de imagem e poesia, cenas da vida das irmãs Petra e Elena.',
      B: 'Descrever, por meio das memórias de Petra, a separação de duas irmãs.',
      C: 'Sintetizar, por meio das principais cenas do filme, a história de Elena.',
      D: 'Lançar, por meio da história de vida do autor, um filme autobiográfico.',
      E: 'Avaliar, por meio de análise crítica, o filme em referência.',
    },
    passos: [
      'O texto conta a vida de Elena e o que a irmã Petra fez vinte anos depois.',
      'No último parágrafo, o tom muda: "Elena é um filme sobre...". O autor passa a comentar uma obra.',
      'Trechos como "essencialmente, um filme sobre a delicadeza" são avaliações. Mostram a opinião de quem escreve.',
      'Resumir e avaliar um filme, num texto publicado em revista, é próprio da resenha crítica.',
      'A, B e C falam só da parte narrativa, que serve de apoio. D erra: o filme não conta a vida do autor do texto.',
      'Resposta: E, avaliar, por meio de análise crítica, o filme em referência.',
    ],
    resposta: 'E',
  },
  pegadinhas: [
    'Classificar o texto pelo tipo que aparece primeiro. Uma resenha pode começar narrando.',
    'Confundir notícia (fato, linguagem objetiva) com artigo de opinião (tese e argumentos).',
    'Esquecer a fonte: revista, jornal, rede social e livro dão pistas do gênero.',
    'Achar que todo texto em versos é poema. Letra de canção, cordel e até anúncio podem ter versos.',
  ],
}
