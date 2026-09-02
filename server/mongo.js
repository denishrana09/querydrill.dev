import { MongoClient } from 'mongodb';

export const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';

// Databases we never seed into or write to.
export const RESERVED_DBS = new Set(['admin', 'local', 'config']);

let client = null;
let connecting = null;

export async function getClient() {
  if (client) return client;
  if (!connecting) {
    const c = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    connecting = c.connect().then((connected) => {
      client = connected;
      connecting = null;
      return client;
    }).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

export async function getDb(name) {
  if (!name) throw new Error('No database selected. Pick one in the header first.');
  const c = await getClient();
  return c.db(name);
}

export function assertWritableDb(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Database name is required.');
  }
  if (RESERVED_DBS.has(name)) {
    throw new Error(`Refusing to touch reserved database "${name}". Pick or create another one.`);
  }
  // Mongo's own restrictions, checked here so the error is readable.
  if (/[/\\. "$*<>:|?]/.test(name)) {
    throw new Error(`Invalid database name "${name}". Avoid spaces and / \\ . " $ * < > : | ?`);
  }
  if (name.length > 63) throw new Error('Database name must be 63 characters or fewer.');
  return name;
}

export async function listDatabases() {
  const c = await getClient();
  const { databases } = await c.db('admin').admin().listDatabases();
  return databases.map((d) => ({
    name: d.name,
    sizeOnDisk: d.sizeOnDisk,
    reserved: RESERVED_DBS.has(d.name),
  }));
}

export async function listCollections(dbName) {
  const db = await getDb(dbName);
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  const out = [];
  for (const col of cols.sort((a, b) => a.name.localeCompare(b.name))) {
    out.push({ name: col.name, count: await db.collection(col.name).countDocuments() });
  }
  return out;
}

export async function serverInfo() {
  const c = await getClient();
  const info = await c.db('admin').admin().serverInfo();
  return { version: info.version, uri: MONGO_URI };
}

export async function closeClient() {
  if (client) {
    await client.close();
    client = null;
  }
}
