// Aula ENEM de Química ambiental e do cotidiano (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2020, questão 120, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2020/questions/120).
// No enunciado, só corrigimos um erro de digitação da API ("reação e combustão" virou "reação de combustão").

export default {
  topic: 'quimica-ambiental',
  title: 'Química ambiental e do cotidiano',
  cai: 'Química ambiental é um dos temas mais frequentes do ENEM. As questões falam de efeito estufa, chuva ácida, lixo, tratamento de água e esgoto, combustíveis e reciclagem. Algumas pedem a ação que reduz um impacto; outras pedem uma conta de estequiometria com dados de emissão.',
  ideias: [
    'Efeito estufa: gases como CO2, CH4 (metano) e vapor de água retêm radiação infravermelha. O excesso, vindo sobretudo da queima de combustíveis fósseis e de queimadas, intensifica o aquecimento global.',
    'Chuva ácida: óxidos de enxofre (SO2, SO3) e de nitrogênio (NO, NO2) reagem com a água do ar e formam ácidos. A chuva normal já é levemente ácida (pH perto de 5,6) por causa do CO2.',
    'O CO2 dissolvido na água forma ácido carbônico e baixa o pH dos oceanos (acidificação), o que prejudica corais e moluscos.',
    'A camada de ozônio (O3) filtra a radiação ultravioleta. Os CFCs, antigos gases de geladeiras e aerossóis, destroem o ozônio.',
    'Eutrofização: excesso de nutrientes (fósforo e nitrogênio de esgoto e fertilizantes) faz as algas crescerem demais, falta oxigênio na água e os peixes morrem.',
    'Metais pesados (chumbo, mercúrio, cádmio) se acumulam nos seres vivos e aumentam ao longo da cadeia alimentar (bioacumulação e biomagnificação).',
    'Tratamento de água: coagulação, floculação, decantação, filtração, desinfecção com cloro e correção do pH.',
    'A combustão completa de um combustível orgânico gera CO2 e H2O. Para comparar emissões, use a proporção em mols da equação balanceada.',
    'Química verde: aproveitar ao máximo os reagentes, gerar pouco resíduo e preferir matérias-primas renováveis e processos seguros.',
  ],
  exemplo: {
    year: 2020,
    number: 120,
    enunciado: 'O crescimento da frota de veículos em circulação no mundo tem levado à busca e desenvolvimento de tecnologias que permitam minimizar emissões de poluentes atmosféricos. O uso de veículos elétricos é uma das propostas mais propagandeadas por serem de emissão zero. Podemos comparar a emissão de carbono na forma de CO2 (massa molar igual a 44 g mol–1) para os dois tipos de carros (a combustão e elétrico). Considere que os veículos tradicionais a combustão, movidos a etanol (massa molar igual a 46 g mol–1), emitem uma média de 2,6 mol de CO2 por quilômetro rodado, e os elétricos emitem o equivalente a 0,45 mol de CO2 por quilômetro rodado (considerando as emissões na geração e transmissão da eletricidade). A reação de combustão do etanol pode ser representada pela equação química:\n\nC2H5OH (l) + 3 O2 (g) → 2 CO2 (g) + 3 H2O (g)\n\nForam analisadas as emissões de CO2 envolvidas em dois veículos, um movido a etanol e outro elétrico, em um mesmo trajeto de 1 000 km.\n\nCHIARADIA, C. A. Estudo da viabilidade da implantação de frotas de veículos elétricos e híbridos elétricos no atual cenário econômico, político, energético e ambiental brasileiro. Guaratinguetá: Unesp, 2015 (adaptado)\n\nA quantidade equivalente de etanol economizada, em quilograma, com o uso do veículo elétrico nesse trajeto, é mais próxima de',
    alternativas: {
      A: '50.',
      B: '60.',
      C: '95.',
      D: '99.',
      E: '120.',
    },
    passos: [
      'Por quilômetro, o carro elétrico deixa de emitir 2,6 - 0,45 = 2,15 mol de CO2.',
      'Em 1 000 km, a economia é de 2,15 · 1 000 = 2 150 mol de CO2.',
      'Pela equação, 1 mol de etanol produz 2 mol de CO2. Então 2 150 mol de CO2 vêm de 2 150 / 2 = 1 075 mol de etanol.',
      'Massa de etanol: 1 075 mol · 46 g/mol = 49 450 g, ou seja, cerca de 49,5 kg.',
      'O valor mais próximo é 50 kg. Resposta: letra A.',
    ],
    resposta: 'A',
  },
  pegadinhas: [
    'Confundir efeito estufa com o buraco na camada de ozônio. São problemas diferentes, causados por gases diferentes.',
    'Achar que o efeito estufa é ruim em si. Ele mantém a Terra habitável; o problema é a sua intensificação.',
    'Dizer que a chuva ácida que causa estragos vem do CO2. Ela vem principalmente de óxidos de enxofre e de nitrogênio.',
    'Esquecer a proporção da equação: 1 mol de etanol gera 2 mol de CO2, não 1.',
    'Achar que jogar resíduos em lixão resolve. Remédios, óleo e metais ali contaminam o solo e a água subterrânea.',
  ],
}
