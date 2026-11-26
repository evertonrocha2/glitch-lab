// ENEM lesson: Razão, proporção e porcentagem (matematica).
// Example: ENEM 2022, questão 167 (api.enem.dev), official answer A.

export default {
  topic: 'razao-proporcao-porcentagem',
  title: 'Razão, proporção e porcentagem',
  cai: 'É um dos temas que mais caem em Matemática no ENEM. Aparece em preços com desconto e acréscimo, receitas, misturas, divisão de lucros e regra de três. O truque é transformar porcentagem em fator de multiplicação e saber se as grandezas são direta ou inversamente proporcionais.',
  ideias: [
    'Razão é uma divisão que compara duas grandezas: a/b. Exemplo: 3 meninas para 2 meninos é a razão 3/2.',
    'Proporção é a igualdade de duas razões: a/b = c/d. Multiplicando cruzado, a · d = b · c (regra de três).',
    'Diretamente proporcionais: se uma dobra, a outra dobra. Inversamente proporcionais: se uma dobra, a outra cai pela metade.',
    'Porcentagem é razão com denominador 100: 15% = 15/100 = 0,15.',
    'Aumento de p%: multiplique por (1 + p/100). Aumento de 10% é multiplicar por 1,10.',
    'Desconto de p%: multiplique por (1 − p/100). Desconto de 2% é multiplicar por 0,98.',
    'Aumentos e descontos seguidos se multiplicam, não se somam: +10% e depois −2% dá 1,10 × 0,98 = 1,078, ou seja, +7,8%.',
    'Divisão proporcional: para dividir um total em partes proporcionais a 2, 3 e 5, some 2 + 3 + 5 = 10 e cada parte vale total ÷ 10 vezes o seu número.',
    'Variação percentual = (valor novo − valor antigo) ÷ valor antigo × 100.',
  ],
  exemplo: {
    year: 2022,
    number: 167,
    enunciado:
      'Em uma loja, o preço promocional de uma geladeira é de R$ 1 000,00 para pagamento somente em dinheiro. Seu preço normal, fora da promoção, é 10% maior. Para pagamento feito com o cartão de crédito da loja, é dado um desconto de 2% sobre o preço normal. Uma cliente decidiu comprar essa geladeira, optando pelo pagamento com o cartão de crédito da loja. Ela calculou que o valor a ser pago seria o preço promocional acrescido de 8%. Ao ser informada pela loja do valor a pagar, segundo sua opção, percebeu uma diferença entre seu cálculo e o valor que lhe foi apresentado. O valor apresentado pela loja, comparado ao valor calculado pela cliente, foi',
    alternativas: {
      A: 'R$ 2,00 menor.',
      B: 'R$ 100,00 menor.',
      C: 'R$ 200,00 menor.',
      D: 'R$ 42,00 maior.',
      E: 'R$ 80,00 maior.',
    },
    passos: [
      'Preço normal: 10% maior que R$ 1 000,00. Então 1 000 × 1,10 = R$ 1 100,00.',
      'Pagamento no cartão: desconto de 2% sobre o preço normal. Então 1 100 × 0,98 = R$ 1 078,00. Esse é o valor da loja.',
      'Cálculo da cliente: ela fez +10% − 2% = +8% direto sobre o preço promocional. Então 1 000 × 1,08 = R$ 1 080,00.',
      'Compare: 1 078 − 1 080 = −2. O valor da loja é R$ 2,00 menor.',
      'O erro da cliente foi somar porcentagens que incidem sobre bases diferentes. O certo é multiplicar os fatores: 1,10 × 0,98 = 1,078.',
      'A resposta é a letra A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Somar porcentagens seguidas (+10% e −2% = +8%). Os fatores se multiplicam, porque cada porcentagem incide sobre um valor diferente.',
    'Achar que subir 20% e depois descer 20% volta ao preço inicial. Na verdade 1,2 × 0,8 = 0,96, uma queda de 4%.',
    'Confundir "queda de 75%" com "ficou 75%". Se caiu 75%, sobrou 25% do valor antigo.',
    'Montar regra de três direta quando as grandezas são inversas, como número de trabalhadores e tempo de obra.',
  ],
}
