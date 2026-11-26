// Aula ENEM de Biologia, citologia e bioquímica (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2019, questão 127, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2019/questions/127).

export default {
  topic: 'biologia-celula',
  title: 'Biologia: citologia e bioquímica',
  cai: 'O ENEM cobra a célula pelo funcionamento: como ela obtém energia, como produz proteínas e como troca substâncias com o meio. As questões costumam trazer um remédio, uma toxina, uma vacina ou um alimento e perguntar qual etapa ou organela foi afetada. Fotossíntese, respiração celular e síntese de proteínas são os temas mais comuns.',
  ideias: [
    'Célula procariótica (bactérias) não tem núcleo nem organelas membranosas. Célula eucariótica tem núcleo e organelas.',
    'Membrana plasmática: dupla camada de fosfolipídios com proteínas, seletivamente permeável.',
    'Transporte passivo vai a favor do gradiente e não gasta ATP: difusão simples, difusão facilitada e osmose (passagem de água). Transporte ativo vai contra o gradiente e gasta ATP, como a bomba de sódio e potássio.',
    'Organelas principais: mitocôndria (respiração celular), cloroplasto (fotossíntese), ribossomo (síntese de proteínas), lisossomo (digestão dentro da célula) e complexo golgiense (secreção).',
    'Respiração aeróbica: C6H12O6 + 6 O2 → 6 CO2 + 6 H2O + energia. Etapas: glicólise (citoplasma), ciclo de Krebs e cadeia respiratória (mitocôndria). A cadeia respiratória produz a maior parte do ATP.',
    'Fermentação: sem oxigênio, rende só 2 ATP por glicose e gera álcool e CO2 (leveduras) ou ácido lático (músculo e algumas bactérias).',
    'Fotossíntese: 6 CO2 + 6 H2O + luz → C6H12O6 + 6 O2, nos cloroplastos.',
    'Síntese de proteínas: DNA → RNA mensageiro (transcrição, no núcleo) → proteína (tradução, nos ribossomos). Cada códon de 3 bases indica um aminoácido.',
    'Enzimas são proteínas que aceleram reações. Funcionam numa faixa ideal de temperatura e pH; fora dela, podem se desnaturar.',
  ],
  exemplo: {
    year: 2019,
    number: 127,
    enunciado: 'O 2,4-dinitrofenol (DNP) é conhecido como desacoplador da cadeia de elétrons na mitocôndria e apresenta um efeito emagrecedor. Contudo, por ser perigoso e pela ocorrência de casos letais, seu uso como medicamento é proibido em diversos países, inclusive no Brasil. Na mitocôndria, essa substância captura, no espaço intermembranas, prótons (H+) provenientes da atividade das proteínas da cadeia respiratória, retornando-os à matriz mitocondrial. Assim, esses prótons não passam pelo transporte enzimático, na membrana interna.\n\nGRUNDLINGH, J. et. al. 2,4-Dinitrophenol (DNP): a Weight Loss Agent with Significant Acute Toxicity and Risk of Death. Journal of Medical Toxicology, v. 7, 2011 (adaptado).\n\nO efeito emagrecedor desse composto está relacionado ao(à):',
    alternativas: {
      A: 'Obstrução da cadeia respiratória, resultando em maior consumo celular de ácidos graxos.',
      B: 'Bloqueio das reações do ciclo de Krebs, resultando em maior gasto celular de energia.',
      C: 'Diminuição da produção de acetil CoA, resultando em maior gasto celular de piruvato.',
      D: 'Inibição da glicólise de ATP, resultando em maior gasto celular de nutrientes.',
      E: 'Redução da produção de ATP, resultando em maior gasto celular de nutrientes.',
    },
    passos: [
      'Na cadeia respiratória, proteínas da membrana interna da mitocôndria bombeiam prótons (H+) para o espaço intermembranas.',
      'Esses prótons voltam para a matriz passando pela enzima ATP sintase, e é essa passagem que produz ATP.',
      'O DNP leva os prótons de volta à matriz por outro caminho, sem passar pela enzima. A energia dessa volta se perde como calor e não vira ATP.',
      'Com menos ATP por molécula de alimento, a célula precisa queimar mais glicose e gordura para manter suas funções. Daí o efeito emagrecedor.',
      'O DNP não bloqueia a cadeia, o ciclo de Krebs nem a glicólise: ele desacopla a cadeia da produção de ATP. Resposta: letra E.',
    ],
    resposta: 'E',
  },
  pegadinhas: [
    'Achar que a planta só faz fotossíntese. Ela também respira o tempo todo, de dia e de noite.',
    'Dizer que a glicólise acontece na mitocôndria. Ela ocorre no citoplasma.',
    'Confundir osmose (movimento de água) com difusão (movimento de soluto).',
    'Achar que a enzima é gasta na reação. Ela sai intacta e pode agir de novo.',
    'Pensar que vacina de RNA mensageiro altera o DNA da pessoa. O RNA é traduzido no citoplasma e não entra no genoma.',
  ],
}
