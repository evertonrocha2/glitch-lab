// ENEM lesson: Funções (matematica).
// Example: ENEM 2019, questão 168 (api.enem.dev), official answer D.

export default {
  topic: 'funcoes',
  title: 'Funções',
  cai: 'O ENEM pede para montar a lei de uma situação, como um custo com parte fixa e parte variável, e para ler gráficos. Função afim é a mais cobrada, seguida da quadrática (máximo e mínimo) e da exponencial (crescimento e decaimento). Logaritmo aparece em escalas como pH e terremotos.',
  ideias: [
    'Função é uma regra que liga cada valor de x a um único valor de y.',
    'Função afim: y = a · x + b. O b é o valor fixo (quando x = 0) e o a é quanto y muda a cada unidade de x.',
    'Se a > 0, a função cresce. Se a < 0, decresce. O gráfico é uma reta.',
    'Função quadrática: y = a · x² + b · x + c. O gráfico é uma parábola, com boca para cima se a > 0 e para baixo se a < 0.',
    'Vértice da parábola: x do vértice = −b ÷ (2a). É ali que fica o valor máximo ou mínimo.',
    'Raízes da quadrática pela fórmula de Bhaskara: Δ = b² − 4ac e x = (−b ± √Δ) ÷ (2a).',
    'Função exponencial: y = a · bˣ. Multiplica sempre pelo mesmo fator a cada passo.',
    'Logaritmo é o expoente: log₁₀ 1 000 = 3, porque 10³ = 1 000.',
  ],
  exemplo: {
    year: 2019,
    number: 168,
    enunciado:
      'Uma empresa tem diversos funcionários. Um deles é o gerente, que recebe R$ 1000,00 por semana. Os outros funcionários são diaristas. Cada um trabalha 2 dias por semana, recebendo R$ 80,00 por dia trabalhado. Chamando de X a quantidade total de funcionários da empresa, a quantia Y, em reais, que esta empresa gasta semanalmente para pagar seus funcionários é expressa por',
    alternativas: {
      A: 'Y = 80X + 920.',
      B: 'Y = 80X + 1000.',
      C: 'Y = 80X + 1080.',
      D: 'Y = 160X + 840.',
      E: 'Y = 160X + 1000.',
    },
    passos: [
      'X é o total de funcionários, e isso inclui o gerente. Então o número de diaristas é X − 1.',
      'Cada diarista ganha 2 × 80 = R$ 160,00 por semana.',
      'Gasto com diaristas: 160 · (X − 1). Gasto com o gerente: R$ 1 000,00.',
      'Y = 1 000 + 160 · (X − 1) = 1 000 + 160X − 160 = 160X + 840.',
      'A resposta é a letra D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Ler X como número de diaristas quando ele é o total de funcionários. É esse erro que leva à letra E.',
    'Usar o valor por dia (80) em vez do valor por semana (160) como taxa de variação.',
    'Achar que o vértice da parábola é onde ela corta o eixo x. O vértice é o ponto de máximo ou mínimo.',
    'Tratar crescimento exponencial como linear: dobrar a cada mês não é somar o mesmo valor todo mês.',
  ],
}
