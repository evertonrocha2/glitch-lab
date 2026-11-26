// Aula ENEM de Química, soluções, reações e físico-química (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2023, questão 104, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2023/questions/104).

export default {
  topic: 'quimica-fisico-quimica',
  title: 'Química: soluções, reações e físico-química',
  cai: 'Físico-química é a parte da química com mais contas no ENEM: concentração, diluição, estequiometria, termoquímica e pH. Também aparecem questões conceituais sobre o que acelera uma reação e para onde um equilíbrio se desloca. O contexto costuma ser remédios, alimentos, pilhas e indústria.',
  ideias: [
    'Concentração comum: C = m / V (g/L). Concentração em quantidade de matéria: M = n / V (mol/L), com n = m / massa molar.',
    'Diluição: a quantidade de soluto não muda, então C1 · V1 = C2 · V2.',
    'Estequiometria: os coeficientes da equação balanceada dão a proporção em mols entre reagentes e produtos.',
    'Termoquímica: reação exotérmica libera calor (ΔH < 0); reação endotérmica absorve calor (ΔH > 0).',
    'A velocidade de uma reação aumenta com temperatura, concentração, superfície de contato e catalisador. O catalisador baixa a energia de ativação e não é consumido.',
    'Princípio de Le Chatelier: um equilíbrio perturbado se desloca para diminuir a perturbação. Acrescentar um reagente desloca para os produtos; retirar uma espécie desloca para repô-la.',
    'pH = -log [H+]. A 25 °C: pH < 7 é ácido, pH = 7 é neutro, pH > 7 é básico. Cada unidade de pH vale 10 vezes na concentração de H+.',
    'Propriedades coligativas: um soluto não volátil aumenta a temperatura de ebulição, diminui a de congelamento e cria pressão osmótica.',
    'Meia-vida: tempo para a quantidade cair pela metade. Depois de n meias-vidas, sobra a fração 1 / 2ⁿ.',
  ],
  exemplo: {
    year: 2023,
    number: 104,
    enunciado: 'O vidro contendo alumínio em sua composição é um excelente material para acondicionar medicamentos e suplementos, porque pode ser esterilizado por aquecimento. No entanto, quando o medicamento ou suplemento contém substâncias que se ligam fortemente ao íon desse metal, a dissolução do alumínio é promovida em função do deslocamento do equilíbrio químico estabelecido entre a espécie imobilizada no vidro e a espécie em solução. Por essa razão, recomenda-se que suplementos de nutrição de recém-nascidos contendo gluconato de cálcio sejam acondicionados em embalagens plásticas, e não nesse tipo de vidro.\n\nAtualização da recomendação da Sociedade Portuguesa de Neonatologia. Disponível em: www.spneonatologia.pt. Acesso em: 22 out. 2021 (adaptado).\n\nCaso esse suplemento seja acondicionado em embalagem desse tipo de vidro, o risco de contaminação por alumínio será maior se o(a)',
    alternativas: {
      A: 'Vidro do frasco for translúcido.',
      B: 'Concentração de gluconato de cálcio for alta.',
      C: 'Frasco de vidro apresentar uma maior espessura.',
      D: 'Vidro for previamente esterilizado em altas temperaturas.',
      E: 'Reação do alumínio com gluconato de cálcio for endotérmica.',
    },
    passos: [
      'O texto descreve um equilíbrio: de um lado, alumínio preso no vidro; do outro, íons de alumínio dissolvidos no suplemento.',
      'O gluconato de cálcio se liga fortemente ao íon alumínio que está na solução. Com isso, ele tira esse íon livre do equilíbrio.',
      'Pelo princípio de Le Chatelier, quando uma espécie é retirada, o equilíbrio se desloca para repô-la. Mais alumínio sai do vidro e se dissolve.',
      'Quanto maior a concentração de gluconato de cálcio, mais alumínio ele captura e maior o deslocamento. Logo, maior a contaminação.',
      'Cor e espessura do vidro não mudam esse equilíbrio, e o texto cita a esterilização por aquecimento como vantagem do material. Resposta: letra B.',
    ],
    resposta: 'B',
  },
  pegadinhas: [
    'Achar que o catalisador aumenta a quantidade de produto no final. Ele só faz a reação chegar mais rápido ao mesmo resultado.',
    'Esquecer de converter mL em L nas contas de concentração.',
    'Pensar que pH 4 é só um pouco mais ácido que pH 5. A concentração de H+ é 10 vezes maior.',
    'Usar a equação sem balancear. Antes de qualquer proporção, confira os coeficientes.',
    'Na diluição, achar que a massa de soluto diminui. Só o volume aumenta; a massa de soluto fica igual.',
  ],
}
