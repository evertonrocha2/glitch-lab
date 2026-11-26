// ENEM lesson for the linguagens topic "lingua-inglesa": what the exam asks, core ideas, one solved question
// and common traps. Example (in English, as on the exam): ENEM 2022, question 4, from api.enem.dev (official answer D).

export default {
  topic: 'lingua-inglesa',
  title: 'Língua inglesa',
  cai: 'São 5 questões de língua estrangeira, e você escolhe inglês ou espanhol na inscrição. Os textos são reais, como poemas, tirinhas, notícias, campanhas e trechos de livros, e as perguntas vêm em português. O ENEM cobra compreensão do texto e o sentido das palavras no contexto, não gramática decorada.',
  ideias: [
    'Leia primeiro o comando em português. Ele diz o que procurar no texto.',
    'Use o título, a fonte e as imagens para prever o assunto antes de ler.',
    'Cognatos ajudam: palavras parecidas com o português, como "favorite", "platform", "anxiety" e "depression".',
    'Cuidado com os falsos cognatos: "actually" é "na verdade", "pretend" é "fingir", "push" é "empurrar", "library" é "biblioteca".',
    'Conectivos guiam a leitura: "but", "however" e "though" marcam contraste; "because" marca causa; "so" marca consequência.',
    'Prefixos e sufixos dão pistas: "un-" e "in-" negam (unhappy, insecure); "-less" indica falta (useless).',
    'Palavras compostas se leem em partes: "down" (para baixo) mais "sides" (lados) dá "downsides", os lados ruins, as desvantagens.',
    'Não precisa entender cada palavra. Entenda a ideia de cada parágrafo.',
  ],
  exemplo: {
    year: 2022,
    number: 4,
    enunciado:
      'A Teen’s View of Social Media\n\n' +
      'Instagram is by far my favorite. It is made up of all photos and videos, which is perfect for visual people like me. There is the home page that showcases the posts from people you follow, an explore tab which offers posts from accounts all over the world, and your own page, with a notification tab to show who likes and comments on your posts.\n\n' +
      'It has some downsides though. It is known to make many people feel insecure or down about themselves because the platform showcases the highlights of everyone’s lives, while rarely showing the negatives. This can make one feel like their life is not going as well as others, contributing to the growing rates of anxiety or depression in many teens today. There is an underlying desire for acceptance through the number of likes or followers one has.\n\n' +
      'Disponível em: https://cyberbullying.org/. Acesso em: 29 out. 2021.\n\n' +
      'O termo “downsides” introduz a ideia de que o Instagram é responsável por',
    alternativas: {
      A: 'Oferecer recursos de fotografia.',
      B: 'Divulgar problemas dos usuários.',
      C: 'Estimular aceitação dos seguidores.',
      D: 'Provocar ansiedade nos adolescentes.',
      E: 'Aproximar pessoas ao redor do mundo.',
    },
    passos: [
      'O texto é de uma adolescente falando do Instagram. O primeiro parágrafo traz o lado bom: fotos, vídeos, posts do mundo todo.',
      'O segundo parágrafo começa com "It has some downsides though". O "though" (porém) anuncia uma virada.',
      '"Downsides" são desvantagens. Depois dessa palavra, o texto lista os problemas.',
      'O Instagram faz as pessoas se sentirem inseguras ("insecure") e contribui para "the growing rates of anxiety or depression in many teens", ou seja, mais ansiedade e depressão entre adolescentes.',
      'A e E são vantagens, do primeiro parágrafo. C inverte a ideia: o texto fala do desejo de aceitação, não de estimular a aceitação. B não aparece no texto.',
      'Resposta: D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Traduzir palavra por palavra e perder a ideia geral.',
    'Marcar algo citado no texto, mas na parte errada, como uma vantagem quando a pergunta pede um problema.',
    'Confiar num falso cognato sem checar o contexto.',
    'Achar que precisa de gramática avançada. O foco é compreensão.',
  ],
}
