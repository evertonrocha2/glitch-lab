// Every ENEM lesson, keyed by topic id. One file per topic (see validate.js for the shape), all
// imported here. The app loads this module lazily, so the lessons stay out of the main bundle.
import interpretacaoTexto from './interpretacao-texto.js'
import generosTextuais from './generos-textuais.js'
import variacaoLinguistica from './variacao-linguistica.js'
import gramaticaFuncoesLinguagem from './gramatica-funcoes-linguagem.js'
import literatura from './literatura.js'
import artes from './artes.js'
import educacaoFisica from './educacao-fisica.js'
import tecnologiasComunicacao from './tecnologias-comunicacao.js'
import linguaInglesa from './lingua-inglesa.js'
import linguaEspanhola from './lingua-espanhola.js'
import historiaBrasilColoniaImperio from './historia-brasil-colonia-imperio.js'
import historiaBrasilRepublica from './historia-brasil-republica.js'
import historiaAntigaMedieval from './historia-antiga-medieval.js'
import historiaModernaContemporanea from './historia-moderna-contemporanea.js'
import geografiaFisicaAmbiente from './geografia-fisica-ambiente.js'
import geografiaPopulacaoUrbanizacao from './geografia-populacao-urbanizacao.js'
import geografiaEconomiaGlobalizacao from './geografia-economia-globalizacao.js'
import geopoliticaConflitos from './geopolitica-conflitos.js'
import cartografia from './cartografia.js'
import filosofia from './filosofia.js'
import sociologia from './sociologia.js'
import cidadaniaDireitos from './cidadania-direitos.js'
import fisicaMecanica from './fisica-mecanica.js'
import fisicaEnergiaTermologia from './fisica-energia-termologia.js'
import fisicaEletricidade from './fisica-eletricidade.js'
import fisicaOndasOptica from './fisica-ondas-optica.js'
import quimicaGeral from './quimica-geral.js'
import quimicaFisicoQuimica from './quimica-fisico-quimica.js'
import quimicaOrganica from './quimica-organica.js'
import quimicaAmbiental from './quimica-ambiental.js'
import biologiaEcologia from './biologia-ecologia.js'
import biologiaGeneticaEvolucao from './biologia-genetica-evolucao.js'
import biologiaCelula from './biologia-celula.js'
import biologiaFisiologiaSaude from './biologia-fisiologia-saude.js'
import biologiaSeresVivos from './biologia-seres-vivos.js'
import aritmetica from './aritmetica.js'
import razaoProporcaoPorcentagem from './razao-proporcao-porcentagem.js'
import grandezasMedidas from './grandezas-medidas.js'
import estatistica from './estatistica.js'
import probabilidadeCombinatoria from './probabilidade-combinatoria.js'
import funcoes from './funcoes.js'
import progressoesSequencias from './progressoes-sequencias.js'
import geometriaPlana from './geometria-plana.js'
import geometriaEspacial from './geometria-espacial.js'
import trigonometria from './trigonometria.js'
import geometriaAnalitica from './geometria-analitica.js'
import matematicaFinanceira from './matematica-financeira.js'

const ALL = [
  interpretacaoTexto,
  generosTextuais,
  variacaoLinguistica,
  gramaticaFuncoesLinguagem,
  literatura,
  artes,
  educacaoFisica,
  tecnologiasComunicacao,
  linguaInglesa,
  linguaEspanhola,
  historiaBrasilColoniaImperio,
  historiaBrasilRepublica,
  historiaAntigaMedieval,
  historiaModernaContemporanea,
  geografiaFisicaAmbiente,
  geografiaPopulacaoUrbanizacao,
  geografiaEconomiaGlobalizacao,
  geopoliticaConflitos,
  cartografia,
  filosofia,
  sociologia,
  cidadaniaDireitos,
  fisicaMecanica,
  fisicaEnergiaTermologia,
  fisicaEletricidade,
  fisicaOndasOptica,
  quimicaGeral,
  quimicaFisicoQuimica,
  quimicaOrganica,
  quimicaAmbiental,
  biologiaEcologia,
  biologiaGeneticaEvolucao,
  biologiaCelula,
  biologiaFisiologiaSaude,
  biologiaSeresVivos,
  aritmetica,
  razaoProporcaoPorcentagem,
  grandezasMedidas,
  estatistica,
  probabilidadeCombinatoria,
  funcoes,
  progressoesSequencias,
  geometriaPlana,
  geometriaEspacial,
  trigonometria,
  geometriaAnalitica,
  matematicaFinanceira,
]

export const LESSONS = Object.fromEntries(ALL.map((lesson) => [lesson.topic, lesson]))

// The lesson for a topic, or null when it has none yet.
export const lessonFor = (topicId) => (Object.hasOwn(LESSONS, topicId) ? LESSONS[topicId] : null)
