// ENEM lesson for the linguagens topic "variacao-linguistica": what the exam asks, core ideas, one solved question
// and common traps. Example: ENEM 2021, question 22, from api.enem.dev (official answer B).

export default {
  topic: 'variacao-linguistica',
  title: 'Variação linguística',
  cai: 'O ENEM cobra variação linguística em quase toda prova. Os textos mostram falares regionais, gírias, linguagem da internet ou mudanças da língua ao longo do tempo. A banca quer que você veja a variação como parte natural da língua e rejeite o preconceito linguístico.',
  ideias: [
    'Toda língua varia. Não existe "português errado", existe uso adequado ou inadequado à situação.',
    'Variação regional (diatópica): muda de lugar para lugar. Exemplo: mandioca, aipim e macaxeira.',
    'Variação social (diastrática): muda com a idade, a escolaridade, a profissão ou o grupo. Gírias e jargões entram aqui.',
    'Variação situacional (diafásica): muda com a situação. Falamos de um jeito com amigos e de outro numa entrevista de emprego.',
    'Variação histórica (diacrônica): a língua muda com o tempo. "Vossa mercê" virou "vosmecê", depois "você" e hoje também "cê".',
    'Norma-padrão é o modelo das gramáticas. É uma variedade de prestígio social, não a única correta.',
    'Preconceito linguístico é julgar uma pessoa pelo jeito de falar. O ENEM sempre o trata como algo a combater.',
    'Adequação: o melhor uso é o que combina com o interlocutor, o gênero do texto e o contexto.',
  ],
  exemplo: {
    year: 2021,
    number: 22,
    enunciado:
      'Os linguistas têm notado a expansão do tratamento informal. “Tenho 78 anos e devia ser tratado por senhor, mas meus alunos mais jovens me tratam por você“, diz o professor Ataliba Castilho, aparentemente sem se incomodar com a informalidade, inconcebível em seus tempos de estudante. O você, porém, não reinará sozinho. O tu predomina em Porto Alegre e convive com o você no Rio de Janeiro e em Recife, enquanto você é o tratamento predominante em São Paulo, Curitiba, Belo Horizonte e Salvador. O tu já era mais próximo e menos formal que você nas quase 500 cartas do acervo on-line de uma instituição universitária, quase todas de poetas, políticos e outras personalidades do final do século XIX e início do XX.\n\n' +
      'Disponível em: http://revistapesquisa.fapesp.br. Acesso em: 21 abr. 2015 (adaptado).\n\n' +
      'No texto, constata-se que os usos de pronomes variaram ao longo do tempo e que atualmente têm empregos diversos pelas regiões do Brasil. Esse processo revela que',
    alternativas: {
      A: 'A escolha de "você" ou de "tu" está condicionada à idade da pessoa que usa o pronome.',
      B: 'A possibilidade de se usar tanto "tu" quanto "você" caracteriza a diversidade da língua.',
      C: 'O pronome "tu" tem sido empregado em situações informais por todo o país.',
      D: 'A ocorrência simultânea de "tu" e de "você" evidencia a inexistência da distinção entre níveis de formalidade.',
      E: 'O emprego de "você" em documentos escritos demonstra que a língua tende a se manter inalterada.',
    },
    passos: [
      'O texto mostra duas variações: a histórica (o tratamento ficou mais informal com o tempo) e a regional (tu em Porto Alegre, você em São Paulo).',
      'O comando pede o que esse processo revela sobre a língua.',
      'A erra: o texto mostra mudanças no tempo e entre regiões, não uma regra ligada à idade de quem fala.',
      'C erra: o tu predomina em algumas cidades, não no país todo. D erra: o texto diz que tu era menos formal que você, então a diferença de formalidade existe.',
      'E erra: o texto mostra justamente que a língua muda.',
      'Usar tu ou você, conforme a região e a época, é sinal da diversidade da língua. Resposta: B.',
    ],
    resposta: 'B',
  },
  pegadinhas: [
    'Marcar a alternativa que chama uma variedade de "errada". O ENEM quase nunca aceita essa visão.',
    'Achar que a norma-padrão serve para qualquer situação. Numa conversa informal, ela pode soar inadequada.',
    'Confundir variação regional (lugar) com variação social (grupo).',
    'Generalizar: se o texto fala de uma região ou de um grupo, a resposta não pode valer "para todo o país".',
  ],
}
