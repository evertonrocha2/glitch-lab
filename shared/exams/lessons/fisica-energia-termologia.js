// Aula ENEM de Física, energia, calor e termodinâmica (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2019, questão 102, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2019/questions/102).

export default {
  topic: 'fisica-energia-termologia',
  title: 'Física: energia, calor e termodinâmica',
  cai: 'O ENEM gosta de energia aplicada: usinas, eletrodomésticos, isolamento térmico, cozinha e clima. As questões pedem para identificar transformações de energia, calcular calor e rendimento ou explicar trocas de calor por condução, convecção e radiação. Muitas vezes a fórmula vem no texto e o desafio é montar a proporção certa.',
  ideias: [
    'Energia cinética: Ec = m · v² / 2. Energia potencial gravitacional: Ep = m · g · h. Sem atrito, a energia mecânica se conserva.',
    'Potência: P = E / Δt, em watts (1 W = 1 J/s). Rendimento: η = energia útil / energia total, sempre menor que 1.',
    'Calor sensível muda a temperatura: Q = m · c · ΔT. Calor latente muda o estado físico: Q = m · L, com a temperatura constante.',
    'O calor passa sozinho do corpo mais quente para o mais frio, até o equilíbrio térmico.',
    'Três formas de propagar calor: condução (contato, principalmente em sólidos), convecção (correntes em líquidos e gases) e radiação (ondas eletromagnéticas, funciona até no vácuo).',
    'Fluxo de calor por condução: Φ = k · A · ΔT / e. Cresce com a condutividade k, a área A e a diferença de temperatura, e cai com a espessura e.',
    '1ª lei da termodinâmica: Q = τ + ΔU. O calor recebido vira trabalho e variação de energia interna.',
    '2ª lei: nenhuma máquina térmica transforma todo o calor em trabalho. Sempre sobra calor para a fonte fria.',
    'Gases ideais: p · V / T = constante, com T em kelvin (T = θ + 273, θ em °C).',
  ],
  exemplo: {
    year: 2019,
    number: 102,
    enunciado: 'O objetivo de recipientes isolantes térmicos é minimizar as trocas de calor com o ambiente externo. Essa troca de calor é proporcional à condutividade térmica k e à área interna das faces do recipiente, bem como à diferença de temperatura entre o ambiente externo e o interior do recipiente, além de ser inversamente proporcional à espessura das faces.\n\nA fim de avaliar a qualidade de dois recipientes A (40 cm x 40 cm x 40 cm) e B (60 cm x 40 cm x 40 cm) de faces de mesma espessura, uma estudante compara suas condutividades térmicas kA e kB. Para isso suspende, dentro de cada recipiente, blocos idênticos de gelo a 0°C, de modo que suas superfícies estejam em contato apenas com o ar. Após um intervalo de tempo, ela abre os recipientes enquanto ambos ainda contêm um pouco de gelo e verifica que a massa de gelo que se fundiu no recipiente B foi o dobro da que se fundiu no recipiente A.\n\nA razão kA/kB é mais próxima de',
    alternativas: {
      A: '0,50.',
      B: '0,67.',
      C: '0,75.',
      D: '1,33.',
      E: '2,00.',
    },
    passos: [
      'O texto diz que o calor trocado é proporcional a k · A · ΔT / e. As espessuras são iguais e a diferença de temperatura também (gelo a 0 °C, mesmo ambiente). Então o calor é proporcional a k · A.',
      'Área interna de A: o cubo de 40 cm tem 6 faces de 40 · 40 = 1 600 cm². Total: 6 · 1 600 = 9 600 cm².',
      'Área interna de B (60 x 40 x 40): 2 faces de 40 · 40, que somam 3 200 cm², e 4 faces de 60 · 40, que somam 9 600 cm². Total: 12 800 cm².',
      'O calor recebido funde o gelo: Q = m · L. Se em B fundiu o dobro da massa, B recebeu o dobro de calor: QB = 2 · QA.',
      'Logo kB · 12 800 = 2 · kA · 9 600, ou seja, kB · 12 800 = kA · 19 200.',
      'kA / kB = 12 800 / 19 200 = 2/3 ≈ 0,67. Resposta: letra B.',
    ],
    resposta: 'B',
  },
  pegadinhas: [
    'Confundir calor com temperatura. Calor é energia em trânsito; temperatura mede a agitação das partículas.',
    'Achar que a temperatura sobe durante a mudança de estado. Na fusão e na ebulição de uma substância pura ela fica constante.',
    'Dizer que o cobertor esquenta. Ele só diminui a perda de calor do corpo, porque é um isolante.',
    'Usar °C nas fórmulas dos gases. Nelas a temperatura tem de estar em kelvin.',
    'Esquecer que a área de troca de calor de uma caixa é a soma de todas as faces, não só a de uma.',
  ],
}
