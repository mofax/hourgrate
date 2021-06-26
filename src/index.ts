import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { migrate } from "./migrate";

const test_url = "postgresql://username:password@localhost:5432/admin_db";

const program = new Command();
const pkJSON = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json")).toString()
);
program.version(pkJSON.version);

program.option("-pg, --postgres_url <string>", "postgres database url");
program.option("-tu, --test_url", "postgres test url");

program.parse(process.argv);

const options = program.opts();
if (options["postgres_url"]) {
  const url: string = options["postgres_url"];
  migrate(url);
} else if (options["test_url"]) {
  const url = test_url;
  migrate(url);
} else {
  program.help();
}
