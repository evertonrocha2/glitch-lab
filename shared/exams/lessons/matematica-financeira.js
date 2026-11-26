// ENEM lesson: Matemática financeira (matematica).
// Example: ENEM 2019, questão 150 (api.enem.dev), official answer B.

export default {
  topic: 'matematica-financeira',
  title: 'Matemática financeira',
  cai: 'O ENEM traz compras parceladas, empréstimos, aplicações e comparação entre pagar à vista ou a prazo. Juros compostos aparecem mais que juros simples, e a prova costuma dar as potências prontas ou números que facilitam a conta. Muitas questões pedem para trazer parcelas futuras para o valor de hoje.',
  ideias: [
    'Juros simples: o juro é sempre calculado sobre o valor inicial. J = C · i · t e M = C · (1 + i · t).',
    'Juros compostos: o juro de cada mês entra na conta do mês seguinte (juro sobre juro). M = C · (1 + i)ᵗ.',
    'Nas fórmulas, a taxa i vai em decimal: 1% = 0,01 e 5% = 0,05. Taxa e tempo precisam estar na mesma unidade (ao mês com meses).',
    'Levar um valor para o futuro: multiplique por (1 + i) a cada período.',
    'Trazer um valor do futuro para hoje: divida por (1 + i) a cada período. Uma parcela paga daqui a t meses vale hoje P ÷ (1 + i)ᵗ.',
    'O valor à vista de uma compra parcelada é a soma das parcelas trazidas para hoje.',
    'Juros compostos crescem mais rápido que juros simples a partir do segundo período.',
    'Lucro = receita − custo. Desconto e acréscimo seguidos se multiplicam, como em porcentagem.',
  ],
  exemplo: {
    year: 2019,
    number: 150,
    enunciado:
      'Uma pessoa se interessou em adquirir um produto anunciado em uma loja. Negociou com o gerente e conseguiu comprá-lo a uma taxa de juros compostos de 1% ao mês. O primeiro pagamento será um mês após a aquisição do produto, e no valor de R$ 202,00. O segundo pagamento será efetuado um mês após o primeiro, e terá o valor de R$ 204,02. Para concretizar a compra, o gerente emitirá uma nota fiscal com o valor do produto à vista negociado com o cliente, correspondendo ao financiamento aprovado. O valor à vista, em real, que deverá constar na nota fiscal é de',
    alternativas: {
      A: '398,02',
      B: '400,00',
      C: '401,94',
      D: '404,00',
      E: '406,02',
    },
    passos: [
      'O valor à vista é o que as duas parcelas valem hoje. Cada parcela precisa ser trazida para a data da compra, tirando os juros.',
      'Primeira parcela, paga em 1 mês: 202 ÷ 1,01 = 200. Confira: 200 × 1,01 = 202.',
      'Segunda parcela, paga em 2 meses: 204,02 ÷ (1,01)². Como 1,01² = 1,0201, dá 204,02 ÷ 1,0201 = 200. Confira: 200 × 1,0201 = 204,02.',
      'Valor à vista: 200 + 200 = R$ 400,00.',
      'A resposta é a letra B.',
    ],
    resposta: 'B',
  },
  pegadinhas: [
    'Somar as parcelas sem tirar os juros (202 + 204,02 = 406,02). Esse é o total pago a prazo, não o valor à vista.',
    'Descontar só 1 mês de juros da segunda parcela, que é paga em 2 meses.',
    'Usar juros simples quando o texto fala em juros compostos.',
    'Usar a taxa em porcentagem direto na fórmula (1 em vez de 0,01) ou misturar taxa ao ano com tempo em meses.',
  ],
}
