// Aula ENEM de Química, matéria, átomos e ligações (área Ciências da Natureza), em pt-BR.
// Questão resolvida: ENEM 2019, questão 108, texto e gabarito de api.enem.dev
// (https://api.enem.dev/v1/exams/2019/questions/108).
// No enunciado, só restauramos os expoentes das configurações eletrônicas, que a API perdeu.

export default {
  topic: 'quimica-geral',
  title: 'Química: matéria, átomos e ligações',
  cai: 'O ENEM cobra química geral ligada a fenômenos reais: teste de chama, fogos de artifício, separação de misturas no tratamento de água e propriedades dos materiais. As questões pedem para explicar um fenômeno com o modelo atômico, a tabela periódica ou o tipo de ligação. Contas são raras e o foco é entender o conceito.',
  ideias: [
    'Átomo: núcleo com prótons (Z) e nêutrons (N), e eletrosfera com elétrons. Número de massa: A = Z + N.',
    'Isótopos têm o mesmo número de prótons e massas diferentes. Íons são átomos que ganharam elétrons (ânions) ou perderam elétrons (cátions).',
    'Modelo de Bohr: o elétron que recebe energia salta para um nível mais externo; ao voltar para um nível mais interno, emite luz de cor característica. É o princípio do teste de chama e dos fogos de artifício.',
    'Tabela periódica: o grupo indica os elétrons de valência; o período indica o número de camadas. Metais tendem a perder elétrons e ametais tendem a ganhar.',
    'Regra do octeto: muitos átomos ficam estáveis com 8 elétrons na camada de valência. Há exceções, como o xenônio no XeF2 e o boro no BF3.',
    'Ligação iônica: o metal transfere elétrons para o ametal (exemplo: NaCl). Forma sólidos de ponto de fusão alto, que conduzem corrente quando fundidos ou dissolvidos em água.',
    'Ligação covalente: ametais compartilham pares de elétrons (exemplos: H2O, CO2). Ligação metálica: elétrons livres entre os átomos, por isso metais conduzem bem.',
    'Separação de misturas: filtração (sólido e líquido), decantação (líquidos que não se misturam ou sólido que afunda), destilação (pontos de ebulição diferentes).',
    'Substância pura tem temperatura constante na fusão e na ebulição; uma mistura comum não tem.',
  ],
  exemplo: {
    year: 2019,
    number: 108,
    enunciado: 'Por terem camada de valência completa, alta energia de ionização e afinidade eletrônica praticamente nula, considerou-se por muito tempo que os gases nobres não formariam compostos químicos. Porém, em 1962, foi realizada com sucesso a reação entre o xenônio (camada de valência 5s² 5p⁶) e o hexafluoreto de platina e, desde então, mais compostos novos de gases nobres vêm sendo sintetizados. Tais compostos demonstram que não se pode aceitar acriticamente a regra do octeto, na qual se considera que, numa ligação química, os átomos tendem a adquirir estabilidade assumindo a configuração eletrônica de gás nobre. Dentre os compostos conhecidos, um dos mais estáveis é o difluoreto de xenônio, no qual dois átomos do halogênio flúor (camada de valência 2s² 2p⁵) se ligam covalentemente ao átomo de gás nobre para ficarem com oito elétrons de valência.\n\nAo se escrever a fórmula de Lewis do composto de xenônio citado, quantos elétrons na camada de valência haverá no átomo do gás nobre?',
    alternativas: {
      A: '6',
      B: '8',
      C: '10',
      D: '12',
      E: '14',
    },
    passos: [
      'O xenônio é um gás nobre: já tem 8 elétrons de valência (5s² 5p⁶).',
      'No XeF2, cada flúor (7 elétrons de valência) faz uma ligação covalente simples com o xenônio, compartilhando um par de elétrons.',
      'Na fórmula de Lewis, o xenônio usa 2 dos seus 8 elétrons nas duas ligações e guarda os outros 6 como 3 pares não ligantes.',
      'Contando ao redor do xenônio: 3 pares livres (6 elétrons) + 2 pares das ligações (4 elétrons) = 10 elétrons.',
      'O xenônio fica com 10 elétrons na camada de valência, uma exceção ao octeto (octeto expandido). Resposta: letra C.',
    ],
    resposta: 'C',
  },
  pegadinhas: [
    'Achar que a cor do teste de chama vem da queima do metal. Ela vem do elétron voltando para um nível de menor energia.',
    'Confundir a subida do elétron (absorve energia) com a volta (emite luz).',
    'Tratar a regra do octeto como lei absoluta. Existem exceções, como XeF2, BF3 e PCl5.',
    'Dizer que composto iônico conduz eletricidade no estado sólido. Ele só conduz fundido ou em solução.',
    'Confundir isótopos (mesmo número de prótons) com isóbaros (mesmo número de massa) e isótonos (mesmo número de nêutrons).',
  ],
}
