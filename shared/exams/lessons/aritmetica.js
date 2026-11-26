// ENEM lesson: Aritmética e números (matematica).
// Example: ENEM 2020, questão 141 (api.enem.dev), official answer A.

export default {
  topic: 'aritmetica',
  title: 'Aritmética e números',
  cai: 'O ENEM traz contas do dia a dia: contar algarismos, dividir em grupos, arredondar e trabalhar com números grandes ou muito pequenos. Quase nunca pede uma fórmula decorada, e sim organização para contar sem esquecer nenhum caso. Divisibilidade, MMC, MDC, frações e notação científica aparecem com frequência.',
  ideias: [
    'Sistema decimal: cada algarismo vale conforme a posição. Em 352, o 3 vale 300, o 5 vale 50 e o 2 vale 2.',
    'Para contar quantas vezes um algarismo aparece, separe por posição: centenas, dezenas e unidades. Depois some.',
    'MMC (mínimo múltiplo comum) resolve problemas de coisas que se repetem e voltam a coincidir, como ônibus ou alarmes.',
    'MDC (máximo divisor comum) resolve problemas de dividir em partes iguais do maior tamanho possível, sem sobra.',
    'Divisão com resto: em 2015 ÷ 5, o resto diz em que ponto de um ciclo você está. Resto 0 é o último item do ciclo.',
    'Frações: a/b de um total é total ÷ b × a. Para comparar frações, use o mesmo denominador ou passe para decimal.',
    'Notação científica: a × 10ⁿ, com 1 ≤ a < 10. Exemplo: 0,00011 = 1,1 × 10⁻⁴.',
    'Ordem das operações: primeiro parênteses, depois potências, depois multiplicação e divisão, por último soma e subtração.',
    'Arredondamento: quando o problema pede "no mínimo" e a conta dá decimal, arredonde para cima (não dá para comprar meia embalagem).',
  ],
  exemplo: {
    year: 2020,
    number: 141,
    enunciado:
      'Um hotel de 3 andares está sendo construído. Cada andar terá 100 quartos. Os quartos serão numerados de 100 a 399 e cada um terá seu número afixado à porta. Cada número será composto por peças individuais, cada uma simbolizando um único algarismo. Qual a quantidade mínima de peças, simbolizando o algarismo 2, necessárias para identificar o número de todos os quartos?',
    alternativas: {
      A: '160',
      B: '157',
      C: '130',
      D: '120',
      E: '60',
    },
    passos: [
      'Conte o algarismo 2 separado por posição: centena, dezena e unidade. Cada peça mostra um só algarismo, então o 222 usa três peças.',
      'Centena: os quartos de 200 a 299 têm 2 na centena. São 100 quartos, logo 100 peças.',
      'Dezena: em cada centena, os números de x20 a x29 têm 2 na dezena. São 10 por centena e há 3 centenas (100, 200 e 300), logo 30 peças.',
      'Unidade: em cada centena, os números terminados em 2 (x02, x12, ..., x92) são 10. Nas 3 centenas, 30 peças.',
      'Total: 100 + 30 + 30 = 160 peças.',
      'A resposta é a letra A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Contar o número 222 uma vez só. Ele tem três algarismos 2 e precisa de três peças.',
    'Esquecer a posição das unidades ou das dezenas e marcar 130 ou 120.',
    'Contar só o andar do meio (200 a 299) e esquecer que os quartos 120, 302 e outros também têm o algarismo 2.',
    'Arredondar para baixo quando o problema pede uma quantidade mínima que precisa ser suficiente.',
  ],
}
