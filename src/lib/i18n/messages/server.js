// Every message the API can answer with ({ message }), plus the API client's own fallbacks.
// The English text is the exact text the server sends, with {name} where it puts a number or a word:
// ../serverMessages.js matches incoming messages against it, so keep the two in step with api/.
// {problem} is a second message (also listed here) that gets translated on its own.
// server.what.* and server.linkLabel.* are the words that fill {what} and {label}.

const en = {
  // The API client itself (no answer from the server).
  'server.client.generic': 'Something went wrong. Please try again.',
  'server.client.offline': 'Could not reach the server. Check your connection.',

  // Any endpoint.
  'server.invalidRequest': 'Invalid request.',
  'server.signIn': 'Sign in to continue.',
  'server.notFound': 'Not found.',
  'server.methodNotAllowed': 'Method not allowed.',
  'server.notAllowed': 'Not allowed.',
  'server.notConfigured': 'Server is not configured.',
  // Only the local dev server sends this one (vite.config.js).
  'server.serverError': 'Server error.',

  // The AI.
  'server.aiBusy': 'The AI is busy right now. Try again in a minute.',
  'server.aiSlow': 'The AI took too long. Try again.',
  'server.aiFailed': 'Something went wrong talking to the AI. Please try again.',
  'server.dailyLimit': 'Daily limit reached. Come back tomorrow.',

  // Accounts.
  'server.wrongPassword': 'Wrong email or password.',
  'server.tooManyWrong': 'Too many wrong passwords for this email. Try again tomorrow.',
  'server.emailInvalid': 'Enter a valid email.',
  'server.passwordShort': 'Use a password with at least {min} characters.',
  'server.emailTaken': 'An account with this email already exists. Sign in instead.',
  'server.accountNotFound': 'Account not found.',

  // New investigation.
  'server.pasteError': 'Paste an error message first.',
  'server.tooLongErrorCode': 'Too long. Keep the error under {error} characters and the code under {code}.',
  'server.tooLongContext': 'Too long. Keep "what you were doing" under {max} characters.',
  'server.attachFiles': 'Attach up to {max} files.',
  'server.tooLongFile': 'Too long. Keep each file under {max} characters.',
  'server.tooLongFiles': 'Too long. Keep all files together under {max} characters.',

  // Gym, daily and global challenges.
  'server.caseNotFound': 'Case not found.',
  'server.challengeNotFound': 'Challenge not found.',
  'server.writeFix': 'Write your fix first.',
  'server.tooLongCode': 'Too long. Keep the code under {max} characters.',
  'server.alreadySolved': 'This challenge is already solved.',
  'server.noMoreHints': 'No more hints.',
  'server.challengeOver': "This challenge is over. Try today's set.",

  // Glitchdle.
  'server.pickMode': 'Pick a game mode.',
  'server.pickLanguage': 'Pick a language from the list.',
  'server.newGlitchdle': 'A new Glitchdle just started. Reload to play it.',
  'server.glitchdleSolved': 'You already solved this one. Come back tomorrow.',
  'server.noGuessesLeft': 'No guesses left in this mode today.',
  'server.alreadyTried': 'You already tried that language.',
  'server.guessClash': 'Another guess landed at the same time. Try again.',

  // Study trail.
  'server.trailNeedsCases': 'Investigate an error on your board first: your trail is built from your cases.',
  'server.trailNotFound': 'Trail not found.',
  'server.missionNotFound': 'Mission not found.',
  'server.missionTicksItself': 'This mission ticks itself when you do it.',
  'server.trailFinished': 'This trail is finished. Tick missions on your current trail.',

  // Assistant.
  'server.tooLongMessage': 'Too long. Keep each message under {max} characters.',

  // Notes.
  'server.noteNotFound': 'Note not found.',
  'server.noPublicNote': 'No public note here.',
  'server.demoShareNote': 'Sign up to share notes on a public profile.',
  'server.tooManyNotes': 'You have {max} notes. Delete one to write another.',
  'server.tooLongTitle': 'Too long. Keep the title under {max} characters.',
  'server.tooManyBlocks': 'Too long. A note holds up to {max} blocks.',
  'server.tooLongBlock': 'Too long. Keep each block under {max} characters.',
  'server.invalidBlock': 'Invalid block.',

  // Profiles.
  'server.noPublicProfile': 'No public profile here.',
  'server.searchChars': 'Search with letters, numbers, spaces, _ . and -, up to {max} characters.',
  'server.demoHandle': 'Sign up to pick a handle and share your profile.',
  'server.handleFirst': 'Pick a handle before making your profile public.',
  'server.handleTaken': 'That handle is taken. Try another one.',
  'server.handleProblem': "That handle won't work. {problem}",
  'server.useAtLeast': 'Use at least {min} characters.',
  'server.useUpTo': 'Use up to {max} characters.',
  'server.handleChars': 'Use only lowercase letters, numbers, _ and -.',
  'server.tooLongField': 'Too long. Keep your {what} under {max} characters.',
  'server.tooManyBadges': 'Pick up to {max} badges.',
  'server.tooManyLanguages': 'Pick up to {max} languages.',
  'server.linkProblem': "That {label} link won't work. {problem}",
  'server.linkTooLong': 'Use a shorter link (up to {max} characters).',
  'server.linkHttps': 'Use a full https:// link.',
  'server.linkSite': 'Use a {site} link.',
  'server.what.name': 'name',
  'server.what.bio': 'bio',
  'server.what.headline': 'headline',
  'server.what.university': 'university',
  'server.what.course': 'course',
  'server.what.job': 'job',
  'server.what.location': 'location',
  'server.what.comment': 'comment',
  'server.linkLabel.GitHub': 'GitHub',
  'server.linkLabel.LinkedIn': 'LinkedIn',
  'server.linkLabel.Website': 'Website',

  // Community.
  'server.articleNotFound': 'Article not found.',
  'server.commentNotFound': 'Comment not found.',
  'server.demoPublish': 'Sign up to publish articles.',
  'server.demoComment': 'Sign up to comment on articles.',
  'server.demoReact': 'Sign up to like and rate articles.',
  'server.ownCommentsOnly': 'You can only delete your own comments.',
  'server.rateOwn': "You can't rate your own article.",
  'server.likeOwn': "You can't like your own article.",
  'server.emptyComment': 'Write something before you post.',
  'server.emptyArticle': 'Write something before you publish.',
  'server.articleTitle': 'Give your article a title.',
  'server.tooLongArticle': 'Too long. Keep the article under {max} characters.',
  'server.tooManyTags': 'Use up to {max} tags.',
  'server.tagLength': 'Keep each tag up to {max} characters.',
  'server.tagChars': 'Tags use only lowercase letters, numbers and -.',
  'server.articlesPerDay': 'You can publish {max} articles a day. Come back tomorrow.',
  'server.commentsPerDay': 'You can post {max} comments a day. Come back tomorrow.',
  'server.caseNotOnBoard': 'That case is not on your board.',
}

const ptBR = {
  'server.client.generic': 'Algo deu errado. Tente de novo.',
  'server.client.offline': 'Não foi possível falar com o servidor. Confira sua conexão.',

  'server.invalidRequest': 'Pedido inválido.',
  'server.signIn': 'Entre para continuar.',
  'server.notFound': 'Não encontrado.',
  'server.methodNotAllowed': 'Método não permitido.',
  'server.notAllowed': 'Não permitido.',
  'server.notConfigured': 'O servidor não está configurado.',
  'server.serverError': 'Erro no servidor.',

  'server.aiBusy': 'A IA está ocupada agora. Tente de novo em um minuto.',
  'server.aiSlow': 'A IA demorou demais. Tente de novo.',
  'server.aiFailed': 'Algo deu errado ao falar com a IA. Tente de novo.',
  'server.dailyLimit': 'Limite diário atingido. Volte amanhã.',

  'server.wrongPassword': 'E-mail ou senha incorretos.',
  'server.tooManyWrong': 'Muitas senhas erradas para este e-mail. Tente de novo amanhã.',
  'server.emailInvalid': 'Digite um e-mail válido.',
  'server.passwordShort': 'Use uma senha com pelo menos {min} caracteres.',
  'server.emailTaken': 'Já existe uma conta com este e-mail. Entre nela.',
  'server.accountNotFound': 'Conta não encontrada.',

  'server.pasteError': 'Cole uma mensagem de erro primeiro.',
  'server.tooLongErrorCode': 'Muito longo. Deixe o erro com menos de {error} caracteres e o código com menos de {code}.',
  'server.tooLongContext': 'Muito longo. Deixe "O que você estava tentando fazer?" com menos de {max} caracteres.',
  'server.attachFiles': 'Anexe até {max} arquivos.',
  'server.tooLongFile': 'Muito longo. Deixe cada arquivo com menos de {max} caracteres.',
  'server.tooLongFiles': 'Muito longo. Deixe todos os arquivos juntos com menos de {max} caracteres.',

  'server.caseNotFound': 'Caso não encontrado.',
  'server.challengeNotFound': 'Desafio não encontrado.',
  'server.writeFix': 'Escreva sua correção primeiro.',
  'server.tooLongCode': 'Muito longo. Deixe o código com menos de {max} caracteres.',
  'server.alreadySolved': 'Este desafio já foi resolvido.',
  'server.noMoreHints': 'Acabaram as dicas.',
  'server.challengeOver': 'Este desafio acabou. Tente os de hoje.',

  'server.pickMode': 'Escolha um modo de jogo.',
  'server.pickLanguage': 'Escolha uma linguagem da lista.',
  'server.newGlitchdle': 'Um novo Glitchdle acabou de começar. Recarregue para jogar.',
  'server.glitchdleSolved': 'Você já resolveu este. Volte amanhã.',
  'server.noGuessesLeft': 'Seus palpites neste modo acabaram por hoje.',
  'server.alreadyTried': 'Você já tentou essa linguagem.',
  'server.guessClash': 'Outro palpite chegou ao mesmo tempo. Tente de novo.',

  'server.trailNeedsCases': 'Investigue um erro no seu board primeiro: sua trilha é montada com os seus casos.',
  'server.trailNotFound': 'Trilha não encontrada.',
  'server.missionNotFound': 'Missão não encontrada.',
  'server.missionTicksItself': 'Esta missão se marca sozinha quando você faz.',
  'server.trailFinished': 'Esta trilha já terminou. Marque missões na sua trilha atual.',

  'server.tooLongMessage': 'Muito longo. Deixe cada mensagem com menos de {max} caracteres.',

  'server.noteNotFound': 'Nota não encontrada.',
  'server.noPublicNote': 'Não tem nota pública aqui.',
  'server.demoShareNote': 'Crie uma conta para compartilhar notas em um perfil público.',
  'server.tooManyNotes': 'Você tem {max} notas. Apague uma para escrever outra.',
  'server.tooLongTitle': 'Muito longo. Deixe o título com menos de {max} caracteres.',
  'server.tooManyBlocks': 'Muito longo. Uma nota cabe até {max} blocos.',
  'server.tooLongBlock': 'Muito longo. Deixe cada bloco com menos de {max} caracteres.',
  'server.invalidBlock': 'Bloco inválido.',

  'server.noPublicProfile': 'Não tem perfil público aqui.',
  'server.searchChars': 'Busque com letras, números, espaços, _ . e -, até {max} caracteres.',
  'server.demoHandle': 'Crie uma conta para escolher um nome de usuário e compartilhar seu perfil.',
  'server.handleFirst': 'Escolha um nome de usuário antes de deixar seu perfil público.',
  'server.handleTaken': 'Esse nome de usuário já está em uso. Tente outro.',
  'server.handleProblem': 'Esse nome de usuário não serve. {problem}',
  'server.useAtLeast': 'Use pelo menos {min} caracteres.',
  'server.useUpTo': 'Use até {max} caracteres.',
  'server.handleChars': 'Use só letras minúsculas, números, _ e -.',
  'server.tooLongField': 'Muito longo. Deixe {what} com menos de {max} caracteres.',
  'server.tooManyBadges': 'Escolha até {max} medalhas.',
  'server.tooManyLanguages': 'Escolha até {max} linguagens.',
  'server.linkProblem': 'Esse link {label} não serve. {problem}',
  'server.linkTooLong': 'Use um link mais curto (até {max} caracteres).',
  'server.linkHttps': 'Use um link completo, com https://.',
  'server.linkSite': 'Use um link do {site}.',
  'server.what.name': 'seu nome',
  'server.what.bio': 'sua bio',
  'server.what.headline': 'seu título',
  'server.what.university': 'sua universidade',
  'server.what.course': 'seu curso',
  'server.what.job': 'seu trabalho',
  'server.what.location': 'sua cidade',
  'server.what.comment': 'seu comentário',
  'server.linkLabel.GitHub': 'do GitHub',
  'server.linkLabel.LinkedIn': 'do LinkedIn',
  'server.linkLabel.Website': 'do site',

  'server.articleNotFound': 'Artigo não encontrado.',
  'server.commentNotFound': 'Comentário não encontrado.',
  'server.demoPublish': 'Crie uma conta para publicar artigos.',
  'server.demoComment': 'Crie uma conta para comentar em artigos.',
  'server.demoReact': 'Crie uma conta para curtir e avaliar artigos.',
  'server.ownCommentsOnly': 'Você só pode apagar os seus próprios comentários.',
  'server.rateOwn': 'Você não pode avaliar o seu próprio artigo.',
  'server.likeOwn': 'Você não pode curtir o seu próprio artigo.',
  'server.emptyComment': 'Escreva algo antes de comentar.',
  'server.emptyArticle': 'Escreva algo antes de publicar.',
  'server.articleTitle': 'Dê um título ao seu artigo.',
  'server.tooLongArticle': 'Muito longo. Deixe o artigo com menos de {max} caracteres.',
  'server.tooManyTags': 'Use até {max} tags.',
  'server.tagLength': 'Deixe cada tag com até {max} caracteres.',
  'server.tagChars': 'Tags usam só letras minúsculas, números e -.',
  'server.articlesPerDay': 'Você pode publicar {max} artigos por dia. Volte amanhã.',
  'server.commentsPerDay': 'Você pode fazer {max} comentários por dia. Volte amanhã.',
  'server.caseNotOnBoard': 'Esse caso não está no seu board.',
}

export default { en, 'pt-BR': ptBR }
