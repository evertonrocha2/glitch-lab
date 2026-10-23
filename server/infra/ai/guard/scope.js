import { normalize } from './normalize.js'

// The cheap scope check: no AI call, nothing counted. Glitch Lab only helps with programming,
// debugging, studying code and using the app. This only catches the obvious cases; everything
// else goes to the model, which decides inside the same call (off_topic / SCOPE: off_topic).
// Conservative on purpose: one programming word anywhere and the text is the model's to judge.

// Words that make a message a programming one, EN and pt-BR (normalized: no accents).
const PROGRAMMING =
  /\b(?:code|codes|coding|codigo|codigos|codar|program\w*|function|funcao|funcoes|method|metodo|variable|variavel|variaveis|loop|loops|laco|array|arrays|vetor|lista|list|string|strings|class|classe|object|objeto|bug|bugs|debug\w*|depur\w*|error|errors|erro|erros|exception|excecao|compil\w*|python|java|javascript|typescript|js|ts|jsx|c\+\+|c#|golang|rust|ruby|php|kotlin|swift|dart|scala|lua|elixir|haskell|sql|html|css|react|vue|angular|node|nodejs|npm|api|apis|json|xml|yaml|git|github|terminal|console|script|scripts|algorithm\w*|algoritmo\w*|recurs\w*|stack|pilha|queue|fila|database|banco de dados|regex|framework|library|biblioteca|lib|app|apps|aplicativo|site|website|web|frontend|backend|server|servidor|deploy|docker|linux|bash|shell|ide|vscode|editor|glitch lab|glitchlab|board|gym|trail|trilha|note|notes|nota|notas|case|caso|casos|desafio|challenge|hint|dica|dicas|xp|streak|badge|llm|llms|prompt|prompts|ai|ia|machine learning|token|tokens|async|await|promise|callback|null|undefined|nan|typeerror|syntax|sintaxe|indent\w*|software|hardware|computador|computer|dev|devs|developer|desenvolvedor\w*|chatbot|bot|automat\w*|automac\w*|tutor|exercise|exercicio|interrog\w*|query|index|indice|pointer|ponteiro|memory|memoria|thread|byte|bytes|bit|bits|int|float|boolean|bool|enum|struct|tuple|dict|map|hash|tree|arvore|graph|grafo|sort|ordenar|ordenacao|import|export|module|modulo|package|pacote|test|tests|teste|testes|unit|mock|lint|linter|eslint|prettier|vite|webpack|cli|sdk|http|https|url|endpoint|request|requisicao|response|resposta da api|backend|cache|cookie|session|sessao|login|auth|senha hash|crypto|criptograf\w*|security|seguranca|injection|injecao|jailbreak|vulnerab\w*|exploit|xss|csrf|ddos|firewall)\b/

// Clear requests for something that is not programming. Each one is only checked when no
// programming word shows up, so "write a poem generator in Python" still goes through.
const OFF_TOPIC = [
  // Creative writing: poems, songs, essays, stories.
  /\b(?:write|compose|create|make|generate|give me)\s+(?:me\s+)?(?:an?\s+|some\s+)?(?:short\s+|long\s+|funny\s+|romantic\s+|love\s+|sad\s+|nice\s+)?(?:poem|poetry|sonnet|haiku|song|lyrics|love letter|essay|short story|story|novel|speech|toast|rap)\b/,
  /\b(?:escreva|escreve|escrever|crie|cria|faca|faz|fazer|componha|gere|gera|me (?:de|da|manda|passa))\s+(?:(?:um|uma|uns|umas)\s+)?(?:(?:pequen[oa]|curt[oa]|lind[oa]|bonit[oa])\s+)?(?:poema|poesia|soneto|musica|letra de musica|carta de amor|redacao|dissertacao|historia|historinha|conto|cronica|discurso|rap)\b/,
  // Jokes, recipes, weather, horoscopes, sports.
  /\b(?:tell|give) me (?:a|another|some) jokes?\b/,
  /\b(?:me )?(?:conta|conte) (?:uma |outra )?piadas?\b/,
  /\brecipes? (?:for|of)\b|\bhow (?:do i|to|can i) (?:cook|bake)\b/,
  /\breceitas? (?:de|do|da|pra|para) (?:bolo|pao|torta|lasanha|frango|carne|feijoada|brigadeiro|pizza|macarrao|comida)\b|\bcomo (?:fazer|faco|cozinhar) (?:um |uma )?(?:bolo|pao|torta|lasanha|brigadeiro|pizza|macarrao)\b/,
  /\b(?:weather|forecast) (?:today|tomorrow|in|for|this week)\b|\bprevisao do tempo\b|\bvai chover\b/,
  /\bhoroscop\w*\b|\bmeu signo\b|\bsigno de\b|\bzodiac\b/,
  /\b(?:who (?:won|will win)|quem (?:ganhou|vai ganhar))\s+(?:the |o |a )?(?:game|match|election|world cup|super bowl|jogo|partida|eleicao|copa|brasileirao|campeonato)\b/,
  // Politics and opinions on public figures.
  /\b(?:who|which (?:party|candidate)) should i vote\b|\bem quem (?:eu )?(?:devo |deveria )?votar\b/,
  /\b(?:what do you think|what's your opinion|o que (?:voce|vc) acha|qual (?:e |eh )?(?:a )?sua opiniao)\s+(?:of|about|on|do|da|de|sobre)\s+(?:the\s+|o\s+|a\s+)?(?:lula|bolsonaro|trump|biden|kamala|putin|government|governo|president|presidente|politics|politica|religion|religiao|god|deus|abortion|aborto|elections?|eleic\w*)\b/,
  // Personal, love, medical advice.
  /\b(?:my|minha|meu)\s+(?:girlfriend|boyfriend|wife|husband|crush|ex|namorada|namorado|esposa|marido|ficante|mae|pai|mom|dad)\b[\s\S]{0,80}\b(?:advice|should i|what do i do|help me|conselho|devo|deveria|o que eu faco|me ajuda|me ajude)\b/,
  /\b(?:relationship|love|dating) (?:advice|tips)\b|\bconselhos? (?:amoros\w*|de relacionamento|sobre (?:namoro|relacionamento|amor))\b|\bdicas de (?:namoro|paquera|relacionamento)\b/,
  /\bshould i (?:break up|get married|divorce|quit my job)\b|\b(?:devo|deveria) (?:terminar (?:com|o namoro)|casar|me divorciar|pedir demissao)\b/,
  /\b(?:which|what) (?:medicine|medication|pill|drug) should i\b|\b(?:que|qual) remedio (?:eu )?(?:devo |posso )?tomar\b/,
  // Homework in other subjects.
  /\b(?:do|solve|answer|write|finish|faca|faz|resolva|resolve|responda|termine)\s+(?:my|minha|meu|a minha|o meu)\s+(?:(?:history|biology|chemistry|physics|geography|philosophy|sociology|literature|english|portuguese|math|historia|biologia|quimica|fisica|geografia|filosofia|sociologia|literatura|ingles|portugues|matematica)\s+)?(?:homework|assignment|essay|licao|tarefa|dever|trabalho|redacao)\b/,
  /\b(?:homework|assignment|licao|tarefa|dever de casa|trabalho|prova|redacao)\s+(?:de|of|on|about|sobre)\s+(?:history|biology|chemistry|physics|geography|philosophy|sociology|literature|historia|biologia|quimica|fisica|geografia|filosofia|sociologia|literatura)\b/,
  /\bredacao (?:do |para o |pro )?enem\b|\bresum\w* (?:do|o) livro\b|\bsummar(?:ize|y of) (?:the|this) (?:book|novel|movie|film)\b/,
  /\b(?:fotossintese|photosynthesis|segunda guerra mundial|world war (?:i|ii|1|2|one|two)|revolucao francesa|french revolution|independencia do brasil|guerra fria|cold war|mitose|mitosis|meiose|tabela periodica|periodic table)\b/,
  // Roleplay and translating plain text.
  /\b(?:let'?s|lets) (?:role ?play|roleplay|pretend)\b|\b(?:roleplay|role-play|role play) (?:as|with me)\b|\bvamos (?:fazer (?:um )?)?(?:roleplay|role play|fingir|brincar de)\b/,
  /\b(?:be|act as|pretend to be|finja ser|seja|finge que e)\s+(?:my|minha|meu)\s+(?:girlfriend|boyfriend|wife|husband|friend|therapist|psychologist|namorada|namorado|esposa|marido|amig[oa]|terapeuta|psicolog[oa])\b/,
  /\b(?:translate|traduza|traduz|traduzir|traduzi)\b/,
]

// Characters that only code has much of.
const CODE_CHARS = /[{}()[\];=<>]/g
const LONG_TEXT = 1500

// 'gibberish', 'off_topic' or null. Only for text a person typed to the AI: a chat message, an
// interrogation answer, the "what you were doing" of an error. Never for code or an error message.
export function precheckScope(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return 'gibberish'
  const base = normalize(raw)
  const squeezed = base.replace(/\s+/g, '')
  // Only punctuation or symbols ("?!?!", "......"), or one character over and over ("kkkkkkkk").
  if (squeezed.length >= 4 && !/[\p{L}\p{N}]/u.test(squeezed)) return 'gibberish'
  if (squeezed.length >= 8 && new Set(squeezed).size <= 2) return 'gibberish'
  // A keyboard mash: a couple of long "words" with no vowel at all ("sdfghjkl").
  const words = base.split(/\s+/)
  if (words.length <= 3 && words.some((word) => /^[a-z]{8,}$/.test(word) && !/[aeiouy]/.test(word))) return 'gibberish'

  if (PROGRAMMING.test(base)) return null
  if ((raw.match(CODE_CHARS)?.length ?? 0) >= 4) return null
  if (OFF_TOPIC.some((pattern) => pattern.test(base))) return 'off_topic'
  // A long text with no code and not one programming word: an essay to fix, an article to summarize.
  if (raw.length >= LONG_TEXT) return 'off_topic'
  return null
}
