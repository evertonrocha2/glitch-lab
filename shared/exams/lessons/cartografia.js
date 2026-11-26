// Aula ENEM de Humanas: Cartografia.
// Questão resolvida: ENEM 2020, questão 53 (texto e gabarito de api.enem.dev).

export default {
  topic: 'cartografia',
  title: 'Cartografia',
  cai: 'O ENEM cobra cartografia de forma prática: calcular escala, entender coordenadas e fusos horários e saber o que cada projeção deforma. Às vezes o tema vem disfarçado num texto literário ou numa notícia, como alguém que não sabe onde está. Também aparece a ideia de que todo mapa é uma escolha, com intenções políticas.',
  ideias: [
    'Coordenadas geográficas: a latitude mede, em graus, a distância até a Linha do Equador (0° a 90° norte ou sul); a longitude mede até o Meridiano de Greenwich (0° a 180° leste ou oeste).',
    'Juntas, latitude e longitude localizam qualquer ponto da superfície da Terra a partir dessas duas linhas de referência.',
    'A latitude influencia o clima: perto dos polos faz mais frio, e há dias ou noites que duram semanas em certas épocas do ano.',
    'Fusos horários: a Terra gira 360° em 24 horas, então cada fuso tem 15°. Indo para leste, o horário avança; para oeste, atrasa.',
    'Escala: relação entre a medida no mapa e a medida real. Na escala 1:100.000, 1 cm no mapa vale 100.000 cm, ou seja, 1 km.',
    'Escala grande (como 1:1.000) mostra uma área pequena com muitos detalhes. Escala pequena (como 1:10.000.000) mostra uma área grande com poucos detalhes.',
    'Projeções: passar a Terra redonda para o papel sempre deforma algo. A de Mercator conserva as formas, mas aumenta as áreas perto dos polos; a de Peters conserva as áreas, mas distorce as formas.',
    'Todo mapa tem intenção: a projeção, o centro e o que se destaca mostram uma visão de mundo, como o eurocentrismo da projeção de Mercator.',
    'Novas tecnologias: GPS, sensoriamento remoto (imagens de satélite) e SIG, os sistemas de informação geográfica.',
  ],
  exemplo: {
    year: 2020,
    number: 53,
    enunciado:
      '“Devo estar chegando perto do centro da Terra. Deixe ver: deve ter sido mais de seis mil quilômetros, por aí…” (como se vê, Alice tinha aprendido uma porção de coisas desse tipo na escola, e embora essa não fosse uma oportunidade lá muito boa de demonstrar conhecimentos, já que não havia ninguém por perto para escutá-la, em todo caso era bom praticar um pouco) “… sim, deve ser mais ou menos essa a distância… mas então qual seria a latitude ou longitude em que estou?” (Alice não tinha a menor ideia do que fosse latitude ou longitude, mas acho que eram palavras muito imponentes).\n\nCARROLL, L. Aventuras de Alice: no País das Maravilhas, Através do espelho e outros textos. São Paulo: Summus, 1980.\n\nO texto descreve uma confusão da personagem em relação',
    alternativas: {
      A: 'Ao tipo de projeção cartográfica.',
      B: 'Aos contornos dos fusos horários.',
      C: 'À localização do norte magnético.',
      D: 'Aos referenciais de posição relativa.',
      E: 'Às distorções das formas continentais.',
    },
    passos: [
      'Leia o que Alice pergunta: depois de cair muito, ela quer saber em que latitude ou longitude está. Mas o narrador avisa que ela não tinha ideia do que fossem.',
      'Latitude e longitude não são lugares: são referenciais. Elas dizem onde um ponto está em relação ao Equador e ao Meridiano de Greenwich, sobre a superfície da Terra.',
      'Alice está caindo em direção ao centro da Terra, não andando pela superfície. As coordenadas não medem profundidade, então a pergunta dela não faz sentido.',
      'Descarte: A e E tratam de como se desenha o mapa, não de localizar um ponto. B, fusos horários, depende da longitude, mas não é a dúvida dela. C, norte magnético, é assunto de bússola.',
      'A confusão de Alice é sobre os referenciais que definem a posição de um ponto. Resposta: D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Confundir latitude (paralelos, norte e sul) com longitude (meridianos, leste e oeste).',
    'Inverter escala grande e pequena. Quanto maior o número depois dos dois pontos, menor a escala e menos detalhe.',
    'Achar que existe mapa sem distorção. Toda projeção deforma área, forma, distância ou direção.',
    'Errar o sentido do fuso: quem está a leste tem o relógio adiantado. Tóquio está à frente de Brasília.',
  ],
}
