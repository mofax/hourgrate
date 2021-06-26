import { promises as fsp } from "fs";
import * as path from "path";

export const migrationsFolderPath = path.join(process.cwd(), "migrations");

const migrationFileNameRegex = /^(\d{1,5})(__)(\w+)()(\.sql)/;
const matchMigrationFileName = (str: string) => {
  return migrationFileNameRegex.test(str);
};

export const assert = (check: boolean, message: string) => {
  if (check !== true) {
    console.error(message);
    process.exit(1);
  }
};

const exists = async (path: string) => {
  try {
    await fsp.stat(path);
    return true;
  } catch {
    return false;
  }
};

export const readMigrationsFolder = async () => {
  const path = migrationsFolderPath;
  assert(await exists(path), `path ${path} does not exist`);
  const dir = await fsp.opendir(path);
  const files = [];
  for await (const dirent of dir) {
    const match = matchMigrationFileName(dirent.name);
    if (match) {
      files.push(dirent.name);
    } else {
      console.log(`[ignore]: ${dirent.name}`);
    }
  }
  assert(Boolean(files.length), "no migration files were found");
  return files;
};

export const readMigrationFile = async (fileName: string) => {
  const completePath = path.join(migrationsFolderPath, fileName);
  const contents = await fsp.readFile(completePath);
  return contents.toString();
};

export const sortMigrationFiles = (files: string[]) => {
  const internal = [...files];

  function compare(a: number, b: number) {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }

  function fileIndex(fileName: string) {
    const [fileIndex] = fileName.split("__");
    const index = parseInt(fileIndex!);
    if (Number.isNaN(index)) {
      throw new Error(`file ${fileName} has an invalid index`);
    }
    return index;
  }

  internal.sort(function (filea, fileb) {
    return compare(fileIndex(filea), fileIndex(fileb));
  });

  return internal;
};
