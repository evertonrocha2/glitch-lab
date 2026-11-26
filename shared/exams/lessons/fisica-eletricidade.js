// Aula ENEM de Física, eletricidade e magnetismo (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2021, questão 128, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2021/questions/128).

export default {
  topic: 'fisica-eletricidade',
  title: 'Física: eletricidade e magnetismo',
  cai: 'No ENEM, eletricidade aparece em contas de luz, chuveiros, carregadores, circuitos de casa e segurança contra choques. As contas mais comuns usam P = U · i e E = P · Δt, muitas vezes com kWh e conversão de unidades. O magnetismo surge em geradores, motores, transformadores e fogões de indução, quase sempre ligado à indução eletromagnética.',
  ideias: [
    'Corrente elétrica: i = Q / Δt, em ampères (A). Tensão (U) em volts (V). Resistência (R) em ohms (Ω).',
    '1ª lei de Ohm: U = R · i.',
    'Potência elétrica: P = U · i = R · i² = U² / R, em watts (W).',
    'Energia consumida: E = P · Δt. Para ter kWh, use P em kW e Δt em horas. 1 kWh = 3,6 · 10⁶ J.',
    'Em série, a corrente é a mesma e as resistências somam: Req = R1 + R2. Em paralelo, a tensão é a mesma: 1/Req = 1/R1 + 1/R2. As tomadas de casa ficam em paralelo.',
    'Fusível e disjuntor abrem o circuito quando a corrente passa do limite. O fio terra desvia para o solo cargas e correntes indesejadas.',
    'Corrente elétrica cria campo magnético ao redor do fio (experiência de Oersted).',
    'Lei de Faraday: um campo magnético que varia induz corrente elétrica num condutor próximo. Assim funcionam geradores, transformadores e fogões de indução.',
    'O transformador só funciona com corrente alternada. No caso ideal, a potência se conserva: U1 · i1 = U2 · i2.',
  ],
  exemplo: {
    year: 2021,
    number: 128,
    enunciado: 'Carros elétricos estão cada vez mais baratos, no entanto, os órgãos governamentais e a indústria se preocupam com o tempo de recarga das baterias, que é muito mais lento quando comparado ao tempo gasto para encher o tanque de combustível. Portanto, os usuários de transporte individual precisam se conscientizar dos ganhos ambientais dessa mudança e planejar com antecedência seus percursos, pensando em pausas necessárias para recargas.\n\nApós realizar um percurso de 110km, um motorista pretende recarregar as baterias de seu carro elétrico, que tem um desempenho médio de 5,0 km/kWh, usando um carregador ideal que opera a uma tensão de 220 V e é percorrido por uma corrente de 20 A.\n\nQuantas horas são necessárias para recarregar a energia utilizadas nesse percurso?',
    alternativas: {
      A: '0,005',
      B: '0,125',
      C: '2,5',
      D: '5,0',
      E: '8,0',
    },
    passos: [
      'Primeiro, a energia gasta no percurso. O carro faz 5,0 km com 1 kWh, então para 110 km precisa de 110 / 5,0 = 22 kWh.',
      'Agora a potência do carregador: P = U · i = 220 · 20 = 4 400 W = 4,4 kW.',
      'O tempo sai de E = P · Δt, ou seja, Δt = E / P.',
      'Δt = 22 kWh / 4,4 kW = 5,0 h. Resposta: letra D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Confundir potência (kW) com energia (kWh). A conta de luz cobra energia, não potência.',
    'Esquecer de passar W para kW (divida por 1 000) ou minutos para horas antes de calcular kWh.',
    'Achar que o aparelho ligado em tensão maior sempre gasta mais. O gasto depende da potência e do tempo de uso.',
    'Pensar que um ímã parado perto de um fio gera corrente. Só há corrente induzida quando o campo magnético varia.',
    'Achar que o fusível protege a pessoa contra choque. Ele protege o circuito contra excesso de corrente; contra choque, o que ajuda é o aterramento.',
  ],
}
