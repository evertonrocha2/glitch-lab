// Hand fixes on top of the synced data, keyed by Stack Overflow tag. Each says why: the data is
// missing, wrong, or the trait is a judgment call the rules can't make. Players are graded on
// these values, so keep them mainstream (what a student would read on the project's home page).
// `aliases` adds search words; `drop` leaves the item out with a reason; `sitelinks` names how many
// Wikipedias cover the item when its article sits on another Wikidata item.

// Several lists of fixes for the same tags -> one { tag: { ...fields } }.
const merge = (...lists) => {
  const merged = {}
  for (const list of lists) for (const [tag, fields] of Object.entries(list)) merged[tag] = { ...merged[tag], ...fields }
  return merged
}
// { tag: value } -> { tag: { [field]: value } }.
const field = (name, list) => Object.fromEntries(Object.entries(list).map(([tag, value]) => [tag, { [name]: value }]))

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
  // The tag lands on Xamarin.Forms (Q115241968), which has no article; the Xamarin article (on the
  // company's item, Q3073996) covers the SDK: 20 Wikipedias in October 2026.
  xamarin: { area: ['mobile'], license: 'mit', year: 2011, maker: 'big-tech', name: 'Xamarin', sitelinks: 20 },
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

const BASE_DATABASE_OVERRIDES = {
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
  // Wikidata: the tag lands on Q113610599, while the English article sits on Q131309655 (2 Wikipedias in October 2026).
  milvus: { writtenIn: 'go', sitelinks: 2 },
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
  // The second batch: models and years Wikidata leaves out.
  'google-cloud-spanner': { model: ['relational'], query: 'sql', year: 2017 },
  'google-cloud-bigtable': { model: ['wide-column'], query: 'key-commands', year: 2015 },
  hazelcast: { model: ['key-value'], query: 'key-commands', year: 2008 }, // an in-memory data grid
  ignite: { model: ['key-value', 'relational'], query: 'sql' },
  greenplum: { model: ['relational', 'columnar'], query: 'sql' },
  foundationdb: { year: 2013 },
  tarantool: { model: ['key-value'], query: 'key-commands' },
  edgedb: { writtenIn: 'python' },
  'apache-pinot': { model: ['columnar'], query: 'sql', writtenIn: 'java' },
  'apache-kudu': { model: ['columnar'], query: 'sql' },
  keydb: { writtenIn: 'cpp', year: 2019 },
  memgraph: { writtenIn: 'cpp', year: 2017 },
  tdengine: { model: ['time-series'], query: 'sql-dialect', license: 'gpl', year: 2019 }, // AGPL
  // Erlang's own store: key-value tables, queried from Erlang code.
  mnesia: { model: ['key-value'], query: 'key-commands', writtenIn: 'erlang', year: 1999 },
  faunadb: { drop: 'the name finds a board game on Wikidata' },
  aerospike: { drop: 'not on Wikidata' },
  vertica: { drop: 'not on Wikidata' },
  'azure-sql-database': { drop: 'not on Wikidata' },
  objectbox: { drop: 'not on Wikidata' },
  kdb: { drop: 'no Stack Overflow tag' },
  // The Teradata article (on the company's item, Q430745) is the one about the database: 16 Wikipedias in October 2026.
  teradata: { model: ['relational'], query: 'sql', writtenIn: 'undisclosed', license: 'proprietary', year: 1979, sitelinks: 16 },
}

// How far transactions go (ACID in shared/riddle/categories.js), for every database that isn't
// relational: the rule only knows that relational engines run full ACID transactions (all of them
// here do, per Wikipedia's "Comparison of relational database management systems"). Each value is
// what the database's own docs say, as of October 2026.
const DATABASE_ACID = {
  // Document stores.
  mongodb: 'full', // multi-document ACID transactions since 4.0 (2018)
  couchdb: 'partial', // each document update is atomic; no multi-document transactions
  pouchdb: 'partial', // CouchDB's model: atomic per document
  rethinkdb: 'partial', // atomic single-document updates only
  couchbase: 'full', // distributed multi-document ACID transactions since 6.5 (2019)
  ravendb: 'full', // ACID document transactions, cluster-wide ones too
  'google-cloud-firestore': 'full', // transactions and batched writes across documents
  'firebase-realtime-database': 'partial', // transaction() works on one path; multi-path writes are atomic but read nothing
  'azure-cosmosdb': 'partial', // transactions only inside one logical partition
  'amazon-dynamodb': 'full', // TransactWriteItems: ACID across up to 100 items (since 2018)
  // Key-value stores and caches.
  redis: 'partial', // MULTI/EXEC runs commands as one block, but nothing rolls back
  keydb: 'partial', // Redis's MULTI/EXEC
  valkey: 'partial', // Redis's MULTI/EXEC
  memcached: 'none', // a cache: single operations (and check-and-set) only
  rocksdb: 'full', // TransactionDB: multi-key ACID transactions
  leveldb: 'partial', // WriteBatch applies many keys atomically, without isolation or transactions
  lmdb: 'full', // ACID transactions over a memory-mapped B+tree
  'berkeley-db': 'full', // the Transactional Data Store: full ACID
  etcd: 'full', // multi-key Txn requests are atomic and serializable
  foundationdb: 'full', // ACID across keys is the whole point
  riak: 'none', // eventually consistent, no transactions
  hazelcast: 'full', // transactions across maps and queues, two-phase commit, read committed
  tarantool: 'full', // interactive ACID transactions (MVCC since 2.10)
  mnesia: 'full', // transactions are how you use it
  // Wide column.
  cassandra: 'partial', // lightweight transactions: compare-and-set inside one partition
  scylla: 'partial', // Cassandra's lightweight transactions
  hbase: 'partial', // atomic per row; no multi-row transactions
  'google-cloud-bigtable': 'partial', // single-row transactions only
  // Graph.
  neo4j: 'full',
  arangodb: 'full',
  orientdb: 'full',
  memgraph: 'full',
  dgraph: 'full', // distributed ACID transactions
  janusgraph: 'partial', // ACID only on a transactional backend (BerkeleyDB); not on Cassandra or HBase
  // Search, time series, analytics, vectors.
  elasticsearch: 'none',
  solr: 'none',
  meilisearch: 'none',
  influxdb: 'none',
  prometheus: 'none',
  tdengine: 'none',
  'apache-druid': 'none',
  'apache-pinot': 'none',
  milvus: 'none',
  clickhouse: 'partial', // an INSERT into one partition is atomic; multi-statement transactions are experimental
  'apache-kudu': 'partial', // atomic per row; multi-row transactions only for inserts
  'google-bigquery': 'full', // multi-statement transactions since 2021
}

// Databases that keep their working data in RAM (disk, if any, is for durability). Wikidata only
// types SAP HANA as an in-memory database; these are the rest, each by its own docs.
const IN_MEMORY = {
  redis: 'memory',
  keydb: 'memory',
  valkey: 'memory',
  memcached: 'memory',
  hazelcast: 'memory', // an in-memory data grid
  ignite: 'memory', // "memory-centric": persistence is optional
  voltdb: 'memory',
  tarantool: 'memory', // memtx, the default engine; vinyl is the on-disk one
  memgraph: 'memory', // in-memory by default; on-disk storage is the opt-in mode
  mnesia: 'memory', // ram_copies by default; disc_copies still live in RAM with a log on disk
}
// Left on 'disk' on purpose: H2, HSQLDB, SQLite and DuckDB have an in-memory mode but default to a
// file; LMDB maps a file into memory, but the data lives in the file.

// Who makes it, where Wikidata names nobody or only the founders (the rule then says 'community').
const DATABASE_MAKERS = {
  neo4j: 'company', // Neo4j, Inc.
  dgraph: 'company', // Dgraph Labs, then the companies that bought it
  hazelcast: 'company', // Hazelcast, Inc.
  keydb: 'company', // Snap Inc. since 2022
  lmdb: 'company', // Symas Corporation
  meilisearch: 'company', // Meili
  memgraph: 'company', // Memgraph Ltd
  percona: 'company', // Percona LLC
  ravendb: 'company', // RavenDB Ltd (Hibernating Rhinos)
  surrealdb: 'company', // SurrealDB Ltd
  tdengine: 'company', // TDengine (TAOS Data)
  timescaledb: 'company', // Timescale (TigerData)
  voltdb: 'company', // Volt Active Data
  yugabytedb: 'company', // Yugabyte, Inc.
  arangodb: 'company', // ArangoDB GmbH; Wikidata names the founders
  cockroachdb: 'company', // Cockroach Labs; Wikidata names engineers
  scylla: 'company', // ScyllaDB, Inc.; Wikidata names the founders
  greenplum: 'company', // Greenplum Inc., then EMC, Pivotal, VMware and Broadcom
  janusgraph: 'foundation', // a Linux Foundation project
  prometheus: 'foundation', // a CNCF project
  rethinkdb: 'foundation', // at the Linux Foundation since 2017
  valkey: 'foundation', // a Linux Foundation project
  duckdb: 'foundation', // the DuckDB Foundation holds it; DuckDB Labs does most of the work
  leveldb: 'big-tech', // written at Google; Wikidata names Jeff Dean
  memcached: 'community', // Danga Interactive wrote it in 2003; a community project ever since
}

export const DATABASE_OVERRIDES = merge(BASE_DATABASE_OVERRIDES, field('acid', DATABASE_ACID), field('storage', IN_MEMORY), field('maker', DATABASE_MAKERS))
