// The ENEM as the app studies it: four areas, each split into topics. Topic ids are a contract with
// the import's AI pass (scripts/enem/tag.js) and with the database (exam_questions.topic): renaming
// one orphans every question tagged with it. Names are Portuguese only: the exam is Brazilian.

// The foreign language questions (Linguagens 1-5) get their topic from the import, not the AI.
export const FOREIGN_LANGUAGE_TOPIC = { ingles: 'lingua-inglesa', espanhol: 'lingua-espanhola' }

const topics = (list) => list.map(([id, name]) => ({ id, name }))

export const ENEM = {
  id: 'enem',
  name: 'ENEM',
  areas: [
    {
      id: 'linguagens',
      shortName: 'Linguagens',
      name: 'Linguagens, Códigos e suas Tecnologias',
      topics: topics([
        ['interpretacao-texto', 'Interpretação de texto'],
        ['generos-textuais', 'Gêneros textuais'],
        ['variacao-linguistica', 'Variação linguística'],
        ['gramatica-funcoes-linguagem', 'Gramática e funções da linguagem'],
        ['literatura', 'Literatura'],
        ['artes', 'Artes'],
        ['educacao-fisica', 'Educação física e práticas corporais'],
        ['tecnologias-comunicacao', 'Tecnologias da informação e comunicação'],
        ['lingua-inglesa', 'Língua inglesa'],
        ['lingua-espanhola', 'Língua espanhola'],
      ]),
    },
    {
      id: 'humanas',
      shortName: 'Humanas',
      name: 'Ciências Humanas e suas Tecnologias',
      topics: topics([
        ['historia-brasil-colonia-imperio', 'História do Brasil: Colônia e Império'],
        ['historia-brasil-republica', 'História do Brasil: República'],
        ['historia-antiga-medieval', 'História antiga e medieval'],
        ['historia-moderna-contemporanea', 'História moderna e contemporânea'],
        ['geografia-fisica-ambiente', 'Geografia física e meio ambiente'],
        ['geografia-populacao-urbanizacao', 'População, urbanização e espaço agrário'],
        ['geografia-economia-globalizacao', 'Economia, indústria e globalização'],
        ['geopolitica-conflitos', 'Geopolítica e conflitos'],
        ['cartografia', 'Cartografia'],
        ['filosofia', 'Filosofia'],
        ['sociologia', 'Sociologia'],
        ['cidadania-direitos', 'Cidadania, direitos humanos e movimentos sociais'],
      ]),
    },
    {
      id: 'natureza',
      shortName: 'Natureza',
      name: 'Ciências da Natureza e suas Tecnologias',
      topics: topics([
        ['fisica-mecanica', 'Física: mecânica'],
        ['fisica-energia-termologia', 'Física: energia, calor e termodinâmica'],
        ['fisica-eletricidade', 'Física: eletricidade e magnetismo'],
        ['fisica-ondas-optica', 'Física: ondas, som e óptica'],
        ['quimica-geral', 'Química: matéria, átomos e ligações'],
        ['quimica-fisico-quimica', 'Química: soluções, reações e físico-química'],
        ['quimica-organica', 'Química orgânica'],
        ['quimica-ambiental', 'Química ambiental e do cotidiano'],
        ['biologia-ecologia', 'Biologia: ecologia e meio ambiente'],
        ['biologia-genetica-evolucao', 'Biologia: genética e evolução'],
        ['biologia-celula', 'Biologia: citologia e bioquímica'],
        ['biologia-fisiologia-saude', 'Biologia: corpo humano e saúde'],
        ['biologia-seres-vivos', 'Biologia: seres vivos'],
      ]),
    },
    {
      id: 'matematica',
      shortName: 'Matemática',
      name: 'Matemática e suas Tecnologias',
      topics: topics([
        ['aritmetica', 'Aritmética e números'],
        ['razao-proporcao-porcentagem', 'Razão, proporção e porcentagem'],
        ['grandezas-medidas', 'Grandezas, medidas e escalas'],
        ['estatistica', 'Estatística'],
        ['probabilidade-combinatoria', 'Probabilidade e análise combinatória'],
        ['funcoes', 'Funções'],
        ['progressoes-sequencias', 'Sequências e progressões'],
        ['geometria-plana', 'Geometria plana'],
        ['geometria-espacial', 'Geometria espacial'],
        ['trigonometria', 'Trigonometria'],
        ['geometria-analitica', 'Geometria analítica'],
        ['matematica-financeira', 'Matemática financeira'],
      ]),
    },
  ],
}
