// Aula ENEM de Biologia, ecologia e meio ambiente (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2019, questão 97, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2019/questions/97).

export default {
  topic: 'biologia-ecologia',
  title: 'Biologia: ecologia e meio ambiente',
  cai: 'Ecologia é um dos temas que mais caem em Biologia no ENEM. As questões trazem uma notícia ou um estudo e pedem a relação entre os seres vivos, o papel de cada um na cadeia alimentar ou o efeito de uma ação humana no ambiente. Biomas brasileiros, ciclos da matéria e sucessão ecológica também aparecem bastante.',
  ideias: [
    'Níveis de organização: população (uma espécie), comunidade (várias espécies), ecossistema (comunidade + ambiente físico).',
    'Cadeia alimentar: produtores (fazem fotossíntese), consumidores e decompositores. A energia flui num só sentido e diminui a cada nível; a matéria é reciclada.',
    'Relações harmônicas: mutualismo (as duas ganham, com dependência), protocooperação (as duas ganham, sem dependência) e comensalismo (uma ganha, a outra não perde nada).',
    'Relações desarmônicas: predação, parasitismo, competição (disputa pelo mesmo recurso) e amensalismo.',
    'Competição intraespecífica acontece entre indivíduos da mesma espécie; interespecífica, entre espécies diferentes.',
    'Nicho ecológico é o modo de vida da espécie (o que come, quando age, com quem interage). Hábitat é o lugar onde ela vive.',
    'Sucessão ecológica: espécies pioneiras ocupam uma área nua, melhoram o solo e abrem caminho para espécies mais exigentes, até a comunidade clímax.',
    'Ciclo do carbono: a fotossíntese retira CO2 do ar; respiração, decomposição e queimas devolvem. Ciclo do nitrogênio: bactérias fixam o N2 do ar e o deixam disponível para as plantas.',
    'Biomas brasileiros: Amazônia, Cerrado, Caatinga, Mata Atlântica, Pampa e Pantanal, cada um com clima e adaptações próprias.',
  ],
  exemplo: {
    year: 2019,
    number: 97,
    enunciado: 'As cutias, pequenos roedores das zonas tropicais, transportam pela boca as sementes que caem das árvores, mas, em vez de comê-las, enterram-nas em outro lugar. Esse procedimento lhes permite salvar a maioria de suas sementes enterradas para as épocas mais secas, quando não há frutos maduros disponíveis. Cientistas descobriram que as cutias roubam as sementes enterradas por outra, e esse comportamento de “ladroagem” faz com que uma mesma semente possa ser enterrada dezenas de vezes.\n\nDisponível em: http://chc.cienciahoje.uol.com.br. Acesso em: 30 jul. 2012.\n\nEssa “ladroagem” está associada à relação de',
    alternativas: {
      A: 'Sinfilia.',
      B: 'Predatismo.',
      C: 'Parasitismo.',
      D: 'Competição.',
      E: 'Comensalismo.',
    },
    passos: [
      'Veja quem interage: cutias com outras cutias. É uma relação entre indivíduos da mesma espécie (intraespecífica).',
      'O recurso em jogo é a semente enterrada, que serve de alimento nas épocas secas.',
      'Quando uma cutia rouba a semente de outra, as duas disputam o mesmo recurso, que é limitado.',
      'Disputa pelo mesmo recurso é competição. Não há predação (nenhuma cutia come a outra) nem parasitismo (nenhuma vive no corpo da outra).',
      'Sinfilia é quando uma espécie cria outra para tirar proveito dela, como formigas e pulgões, e no comensalismo ninguém é prejudicado. Nada disso descreve o roubo entre cutias. Resposta: letra D.',
    ],
    resposta: 'D',
  },
  pegadinhas: [
    'Achar que competição só acontece entre espécies diferentes. Indivíduos da mesma espécie também competem, e muitas vezes mais, porque precisam das mesmas coisas.',
    'Confundir mutualismo (associação obrigatória) com protocooperação (associação útil, mas opcional).',
    'Dizer que a energia é reciclada no ecossistema. A matéria circula; a energia flui e se perde como calor.',
    'Confundir nicho (o papel da espécie) com hábitat (o endereço).',
    'Pensar que uma espécie introduzida sempre se equilibra com as nativas. Sem predadores naturais, ela pode virar praga e reduzir a biodiversidade.',
  ],
}
