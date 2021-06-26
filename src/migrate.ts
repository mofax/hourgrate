import { Pool } from "pg";
import {
  readMigrationFile,
  readMigrationsFolder,
  sortMigrationFiles,
} from "./tools";
import { createHash } from "crypto";

const migrationsTable = "__hourgrate__";
const setUpSQL = `
create table if not exists ${migrationsTable} (
    file_index int not null primary key,
    file_name text not null,
    content_sha256 text not null unique,
    created_at timestamp default now()
);
`;

function createMigrationEntrySQL(
  index: number,
  fileName: string,
  hash: Buffer
) {
  const values = [index, `'${fileName}'`, `'${hash.toString("hex")}'`].join(
    ","
  );
  return `INSERT INTO ${migrationsTable} (file_index, file_name, content_sha256) VALUES (${values});`;
}

async function checkIndexExists(pool: Pool, id: number) {
  const value = await pool.query(
    `select * from ${migrationsTable} where file_index=${id}`
  );
  return value.rows;
}

let pool: Pool | null = null;

function transact(pool: Pool, queryText: string) {
  return new Promise((resolve, reject) => {
    pool.connect((_, client, done) => {
      const shouldAbort = (err: Error) => {
        if (err) {
          client.query("ROLLBACK", (rollBackError) => {
            if (rollBackError) {
              done();
              reject(rollBackError);
            } else {
              done();
              reject(err);
            }
          });
        }
        return !!err;
      };

      client.query("BEGIN", (err) => {
        if (shouldAbort(err)) return;

        client.query(queryText, (err, res) => {
          if (shouldAbort(err)) return;

          client.query("COMMIT", (err) => {
            if (err) {
              reject(err);
            }
            done();
            resolve(res);
          });
        });
      });
    });
  });
}

async function processMigrationFile(pool: Pool, fileName: string) {
  console.log(`[process]: ${fileName}`);
  const [fileIndex] = fileName.split("__");
  const index = parseInt(fileIndex!);
  if (Number.isNaN(index)) {
    throw new Error(`file ${fileName} has an invalid index`);
  }
  const rows = await checkIndexExists(pool, index);
  if (rows.length) {
    return;
  }
  const contents = await readMigrationFile(fileName);
  const hasher = createHash("sha256");
  hasher.write(contents);
  const contentHash = hasher.digest();
  const entrySQL = createMigrationEntrySQL(index, fileName, contentHash);
  const query = `${entrySQL}\n${contents}`;
  await transact(pool, query);
}

export function createPool(connectionString: string) {
  if (pool !== null) return pool;
  pool = new Pool({
    connectionString,
  });
  return pool;
}

export async function migrate(url: string) {
  try {
    const cPool = createPool(url);
    console.log("check migrations table");
    await transact(cPool, setUpSQL);
    const rawFileNames = await readMigrationsFolder();
    const files = sortMigrationFiles(rawFileNames);
    for (let fileName of files) {
      await processMigrationFile(cPool, fileName);
    }
  } catch (err) {
    console.error(err);
  }
}
