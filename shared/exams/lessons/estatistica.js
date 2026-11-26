// ENEM lesson: Estatística (matematica).
// Example: ENEM 2020, questão 165 (api.enem.dev), official answer D.

export default {
  topic: 'estatistica',
  title: 'Estatística',
  cai: 'O ENEM cobra média, mediana e moda quase todo ano, muitas vezes a partir de tabelas e gráficos. Também aparecem média ponderada, troca de elementos de um grupo e, às vezes, desvio padrão para comparar regularidade. A ideia mais útil é pensar na soma dos valores, e não só na média.',
  ideias: [
    'Média aritmética = soma dos valores ÷ quantidade de valores. Logo, soma = média × quantidade.',
    'Média ponderada: cada valor é multiplicado pelo seu peso. Média = (v₁ · p₁ + v₂ · p₂ + ...) ÷ (p₁ + p₂ + ...).',
    'Mediana: coloque os valores em ordem. Com quantidade ímpar, é o do meio. Com quantidade par, é a média dos dois do meio.',
    'Moda: o valor que mais se repete. Pode haver mais de uma moda ou nenhuma.',
    'Trocar um elemento de um grupo muda a soma pela diferença entre o novo e o antigo. A média muda essa diferença dividida pelo número de elementos.',
    'Amplitude = maior valor − menor valor.',
    'Desvio padrão mede o quanto os dados se espalham em torno da média. Quanto menor, mais regular é o conjunto.',
    'Em gráficos, leia título, eixos e unidades antes de qualquer conta.',
  ],
  exemplo: {
    year: 2020,
    number: 165,
    enunciado:
      'O técnico de um time de basquete pretende aumentar a estatura média de sua equipe de 1,93 m para, no mínimo, 1,99 m. Para tanto, dentre os 15 jogadores que fazem parte de sua equipe, irá substituir os quatro mais baixos, de estaturas: 1,78 m, 1,82 m, 1,84 m e 1,86 m. Para isso, o técnico contratou um novo jogador de 2,02 m. Os outros três jogadores que ele ainda precisa contratar devem satisfazer à sua necessidade de aumentar a média das estaturas da equipe. Ele fixará a média das estaturas para os três jogadores que ainda precisa contratar dentro do critério inicialmente estabelecido. Qual deverá ser a média mínima das estaturas, em metro, que ele deverá fixar para o grupo de três novos jogadores que ainda irá contratar?',
    alternativas: {
      A: '1,96',
      B: '1,98',
      C: '2,05',
      D: '2,06',
      E: '2,08',
    },
    passos: [
      'Trabalhe com a soma das estaturas. Hoje: 15 × 1,93 = 28,95 m.',
      'Meta: média de pelo menos 1,99 m com os mesmos 15 jogadores. Soma mínima: 15 × 1,99 = 29,85 m.',
      'Saem os quatro mais baixos: 1,78 + 1,82 + 1,84 + 1,86 = 7,30 m. Sobra 28,95 − 7,30 = 21,65 m.',
      'Entra o jogador de 2,02 m: 21,65 + 2,02 = 23,67 m.',
      'Os três que faltam precisam somar pelo menos 29,85 − 23,67 = 6,18 m. A média deles é 6,18 ÷ 3 = 2,06 m.',
      'A resposta é a letra D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Tirar a média das médias. Quando os grupos têm tamanhos diferentes, isso dá errado: use a soma.',
    'Esquecer de colocar os valores em ordem antes de achar a mediana.',
    'Com quantidade par de valores, escolher um dos dois do meio em vez de fazer a média dos dois.',
    'Esquecer um jogador que já foi contratado e dividir a diferença por 4 em vez de 3.',
  ],
}
