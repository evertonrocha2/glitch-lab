// ENEM lesson: Probabilidade e análise combinatória (matematica).
// Example: ENEM 2019, questão 156 (api.enem.dev), official answer C.

export default {
  topic: 'probabilidade-combinatoria',
  title: 'Probabilidade e análise combinatória',
  cai: 'O ENEM pede para contar possibilidades em senhas, placas, cardápios, times e duplas, quase sempre com alguma restrição. Na probabilidade, aparecem sorteios, urnas, eventos independentes e o famoso "pelo menos um". Saber quando a ordem importa decide se você usa arranjo ou combinação.',
  ideias: [
    'Princípio multiplicativo: se uma escolha tem m opções e outra tem n, as duas juntas têm m × n possibilidades.',
    'Permutação: n objetos em fila podem ser ordenados de n! formas. Exemplo: 4! = 4 × 3 × 2 × 1 = 24.',
    'Arranjo (a ordem importa): A(n, p) = n! ÷ (n − p)!. Use para pódio, senha, cargos diferentes.',
    'Combinação (a ordem não importa): C(n, p) = n! ÷ [p! · (n − p)!]. Use para grupos, comissões, duplas.',
    'Com restrição, uma saída é contar o total e tirar os casos proibidos.',
    'Probabilidade = casos favoráveis ÷ casos possíveis, quando todos os casos são igualmente prováveis.',
    'Eventos independentes acontecendo juntos: multiplique as probabilidades. Eventos que se excluem, com "ou": some.',
    'Pelo menos um: P(pelo menos um) = 1 − P(nenhum).',
    'Probabilidade condicional: P(A dado B) = P(A e B) ÷ P(B).',
  ],
  exemplo: {
    year: 2019,
    number: 156,
    enunciado:
      'Durante suas férias, oito amigos, dos quais dois são canhotos, decidem realizar um torneio de vôlei de praia. Eles precisam formar quatro duplas para a realização do torneio. Nenhuma dupla pode ser formada por dois jogadores canhotos. De quantas maneiras diferentes podem ser formadas essas quatro duplas?',
    alternativas: {
      A: '69',
      B: '70',
      C: '90',
      D: '104',
      E: '105',
    },
    passos: [
      'Primeiro conte todas as formas de dividir 8 pessoas em 4 duplas, sem restrição. Pegue uma pessoa: ela tem 7 parceiros possíveis.',
      'Sobram 6 pessoas. Pegue uma delas: 5 parceiros possíveis. Sobram 4: 3 parceiros. Sobram 2: 1 parceiro.',
      'Total sem restrição: 7 × 5 × 3 × 1 = 105 formas.',
      'Agora conte os casos proibidos: os dois canhotos juntos. Eles formam uma dupla, e as outras 6 pessoas se dividem em 5 × 3 × 1 = 15 formas.',
      'Formas permitidas: 105 − 15 = 90.',
      'Conferindo de outro jeito: o primeiro canhoto escolhe um dos 6 destros, o segundo canhoto escolhe um dos 5 destros que sobraram, e os 4 restantes formam duplas de 3 formas. Dá 6 × 5 × 3 = 90.',
      'A resposta é a letra C.',
    ],
    resposta: 'C',
  },
  pegadinhas: [
    'Esquecer a restrição e marcar o total, 105.',
    'Usar arranjo quando a ordem não importa. A dupla Ana e Beto é a mesma que Beto e Ana.',
    'Somar probabilidades de eventos que acontecem juntos. Para "e" com eventos independentes, multiplique.',
    'Calcular "pelo menos um" caso a caso. É mais rápido fazer 1 menos a chance de nenhum.',
  ],
}
