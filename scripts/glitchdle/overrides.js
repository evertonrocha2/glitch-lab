// Hand fixes on top of the synced data, keyed by Stack Overflow tag. Each says why: the data is
// missing, wrong, or the trait is a judgment call the rules can't make. Players are graded on
// these values, so keep them mainstream (what a student would read on the project's home page).
// `aliases` adds search words; `drop` leaves the item out with a reason.

export const FRAMEWORK_OVERRIDES = {
  // Wikidata calls every JavaScript web framework the same thing, so the rules can't tell
  // the browser from the server.
  express: { area: ['backend'] },
  nestjs: { area: ['backend'] },
  fastify: { area: ['backend'] },
  meteor: { area: ['frontend', 'backend'] },
  'next.js': { area: ['frontend', 'backend'] },
  'nuxt.js': { area: ['frontend', 'backend'] },
  // Picked up "mobile" or "desktop" from related items; they're browser UI libraries.
  reactjs: { area: ['frontend'] },
  preact: { area: ['frontend'], kind: 'library', name: 'Preact' },
  polars: { area: ['data'] },
  // Testing tools listed only as "JavaScript library".
  jestjs: { area: ['testing'], year: 2014 },
  'mocha.js': { area: ['testing'] },
  puppeteer: { area: ['testing'], year: 2017 },
  'react-native': { area: ['mobile'] },
  electron: { area: ['desktop'] },
  'three.js': { kind: 'library', year: 2010 },
  // No area on record, or only "software framework".
  flutter: { area: ['mobile'] },
  opencv: { area: ['data'] },
  hadoop: { area: ['data'] },
  tauri: { area: ['desktop'] },
  tkinter: { area: ['desktop'], year: 1991 },
  pygame: { area: ['games'] },
  libgdx: { area: ['games'] },
  quarkus: { area: ['backend'], kind: 'framework' },
  'go-gin': { area: ['backend'], kind: 'framework', name: 'Gin' },
  playwright: { area: ['testing'] },
  langchain: { language: 'python', area: ['data'] },
  'huggingface-transformers': { language: 'python', area: ['data'], name: 'Hugging Face Transformers', aliases: ['transformers'] },
  // First releases missing on Wikidata (from each project's own release history).
  sinatra: { year: 2007 },
  playframework: { year: 2007 },
  micronaut: { area: ['backend'], year: 2018 },
  keras: { year: 2015 },
  junit: { year: 1997 },
  selenium: { year: 2004 },
  mockito: { area: ['testing'], year: 2008 },
  testng: { year: 2004 },
  rxjs: { year: 2015, name: 'RxJS' },
  'android-jetpack-compose': { area: ['mobile'], year: 2021 },
  swiftui: { area: ['mobile'], license: 'proprietary', year: 2019 },
  xamarin: { area: ['mobile'], license: 'mit', year: 2011, maker: 'big-tech', name: 'Xamarin' },
  wpf: { language: 'csharp', year: 2006, maker: 'big-tech', name: 'WPF', aliases: ['Windows Presentation Foundation'] },
  winforms: { year: 2002, maker: 'big-tech' },
  // Language missing: what people write with it.
  'solid-js': { language: 'javascript' },
  cypress: { language: 'javascript' },
  'phaser-framework': { language: 'javascript', area: ['games'] },
  // Godot's own GDScript isn't in the language list; the engine is C++. Its public release was 2014.
  godot: { language: 'cpp', year: 2014 },
  // Wrong or debatable on Wikidata.
  numpy: { year: 2006 }, // 1995 is Numeric, its ancestor
  'scikit-learn': { year: 2007 },
  'asp.net-core': { maker: 'big-tech' },
  pytorch: { maker: 'big-tech' }, // built at Meta; mainstream answer
  'unreal-engine4': { maker: 'company', year: 1998 },
  'apache-spark': { language: 'scala' },
  // Not found on Wikidata by tag or name.
  'alpine.js': { drop: 'not on Wikidata' },
  koa: { drop: 'not on Wikidata' },
  ktor: { drop: 'not on Wikidata' },
  vitest: { drop: 'not on Wikidata' },
  maui: { drop: 'not on Wikidata' },
  'material-ui': { drop: 'too little data on Wikidata' },
}

export const DATABASE_OVERRIDES = {
  // Models Wikidata only calls "database management system" or "NoSQL".
  'oracle-database': { model: ['relational'], query: 'sql', year: 1979, name: 'Oracle Database', aliases: ['oracle'] },
  cockroachdb: { model: ['relational'], query: 'sql' },
  rethinkdb: { model: ['document'], query: 'document-api' },
  'amazon-dynamodb': { model: ['key-value', 'document'], query: 'document-api' },
  'google-cloud-firestore': { model: ['document'], query: 'document-api', year: 2017 },
  'firebase-realtime-database': { model: ['document'], query: 'document-api', year: 2012 },
  cassandra: { model: ['wide-column'], query: 'sql-dialect' }, // CQL
  scylla: { model: ['wide-column'], query: 'sql-dialect', name: 'ScyllaDB' },
  // HBase has no query language: gets and scans through its API.
  hbase: { model: ['wide-column'], query: 'key-commands' },
  duckdb: { model: ['relational', 'columnar'], query: 'sql', hosting: 'embedded' },
  'google-bigquery': { model: ['columnar'], query: 'sql' },
  'apache-druid': { model: ['columnar', 'time-series'], query: 'sql' },
  pouchdb: { model: ['document'], query: 'document-api', writtenIn: 'javascript', hosting: 'embedded' },
  // CouchDB is written in Erlang; Wikidata lists the JavaScript of its views.
  couchdb: { writtenIn: 'erlang' },
  riak: { writtenIn: 'erlang' },
  milvus: { writtenIn: 'go' },
  // Query languages the model doesn't say.
  prometheus: { query: 'own-language' }, // PromQL
  timescaledb: { model: ['relational', 'time-series'], query: 'sql' }, // a PostgreSQL extension
  surrealdb: { query: 'sql-dialect', year: 2022 }, // SurrealQL; first public release
  orientdb: { query: 'sql-dialect' },
  arangodb: { year: 2011 },
  // Java databases mostly run inside the app.
  h2: { hosting: 'embedded' },
  hsqldb: { hosting: 'embedded' },
  derby: { hosting: 'embedded' },
  // A database in a file, opened by the desktop app.
  'ms-access': { hosting: 'embedded' },
  // Licenses the data leaves out or gets wrong.
  redis: { license: 'gpl' }, // AGPLv3 since Redis 8 (2025), alongside source-available terms
  'berkeley-db': { license: 'gpl' }, // AGPL since 2013
  ravendb: { license: 'gpl', writtenIn: 'csharp' }, // AGPL with a commercial option; written in C#
  mariadb: { license: 'gpl' }, // the server is GPLv2; only its client libraries are LGPL
  // Years missing or off.
  informix: { year: 1981 },
  etcd: { year: 2013 },
  voltdb: { year: 2010 },
  hana: { year: 2010 },
  'azure-cosmosdb': { year: 2017 }, // launched as Cosmos DB in 2017 (DocumentDB before)
  questdb: { drop: 'too little data on Wikidata' },
  teradata: { model: ['relational'], query: 'sql', writtenIn: 'undisclosed', license: 'proprietary', year: 1979 },
}
