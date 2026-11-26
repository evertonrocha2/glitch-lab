// ENEM lesson: Grandezas, medidas e escalas (matematica).
// Example: ENEM 2020, questão 138 (api.enem.dev), official answer B.

export default {
  topic: 'grandezas-medidas',
  title: 'Grandezas, medidas e escalas',
  cai: 'O ENEM pede conversão de unidades, cálculo com mapas e maquetes e comparação de medidas como velocidade, vazão e consumo. A conta costuma ser simples, mas a unidade errada derruba a resposta. Escala com área ou volume é uma das pegadinhas favoritas da prova.',
  ideias: [
    'Comprimento: 1 km = 1 000 m, 1 m = 100 cm, 1 cm = 10 mm.',
    'Área: 1 m² = 10 000 cm² (100 × 100). Hectare: 1 ha = 10 000 m².',
    'Volume: 1 m³ = 1 000 L, 1 dm³ = 1 L, 1 cm³ = 1 mL. E 1 m³ = 1 000 000 cm³.',
    'Tempo: 1 h = 60 min = 3 600 s. Velocidade média = distância ÷ tempo. Para passar de km/h para m/s, divida por 3,6.',
    'Escala = medida no desenho ÷ medida real, nas mesmas unidades. Escala 1 : 200 quer dizer que 1 cm no desenho vale 200 cm de verdade.',
    'Se a escala de comprimento é 1 : k, a de área é 1 : k² e a de volume é 1 : k³.',
    'Grandezas compostas: consumo em km/L, vazão em L/min, densidade em g/cm³. Leia a unidade para saber o que dividir pelo quê.',
    'Converta tudo para a mesma unidade antes de fazer qualquer conta.',
  ],
  exemplo: {
    year: 2020,
    number: 138,
    enunciado:
      'A caixa-d’água de um edifício terá a forma de um paralelepípedo retângulo reto com volume igual a 28 080 litros. Em uma maquete que representa o edifício, a caixa d’água tem dimensões 2 cm x 3,51 cm x 4 cm. Dado: 1 dm³ = 1 L. A escala usada pelo arquiteto foi',
    alternativas: {
      A: '1 : 10',
      B: '1 : 100',
      C: '1 : 1 000',
      D: '1 : 10 000',
      E: '1 : 100 000',
    },
    passos: [
      'Volume na maquete: 2 × 3,51 × 4 = 28,08 cm³.',
      'Volume real: 28 080 L = 28 080 dm³. Como 1 m³ = 1 000 dm³, isso dá 28,08 m³.',
      'Razão entre os volumes: 28,08 cm³ para 28,08 m³. Como 1 m³ = 1 000 000 cm³, o volume real é 1 000 000 vezes o da maquete.',
      'A razão de volumes é o cubo da escala de comprimento. Então k³ = 1 000 000 e k = 100, porque 100 × 100 × 100 = 1 000 000.',
      'A escala de comprimento é 1 : 100.',
      'A resposta é a letra B.',
    ],
    resposta: 'B',
  },
  pegadinhas: [
    'Usar a razão de volumes como se fosse a escala e marcar 1 : 1 000 000 ou o valor mais próximo dele. A escala é sempre de comprimento.',
    'Achar que 1 m² = 100 cm². Na área, o fator de conversão vai ao quadrado: 1 m² = 10 000 cm².',
    'Misturar unidades na mesma conta, como metro com centímetro ou litro com metro cúbico.',
    'Dividir por 3,6 quando era para multiplicar. De m/s para km/h se multiplica por 3,6.',
  ],
}
