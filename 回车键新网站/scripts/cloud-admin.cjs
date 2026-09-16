// Local administration only. Uses the installed CloudBase CLI's existing login;
// credentials remain in memory and are never copied into the website or printed.
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const globalRoot =
  process.env.CLOUDBASE_GLOBAL_ROOT ||
  (process.platform === "win32"
    ? path.join(process.env.APPDATA, "npm", "node_modules")
    : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim());
const cliRoot = path.join(globalRoot, "@cloudbase", "cli");
const { authSupevisor } = require(path.join(cliRoot, "lib/utils/auth.js"));
const CloudBase = require(
  path.join(cliRoot, "node_modules/@cloudbase/manager-node"),
);
const envId = process.env.CLOUDBASE_ENV_ID || "cloud1-5gb0pbyl400845f5";

async function manager() {
  const auth = await authSupevisor.getLoginState();
  if (!auth?.secretId || !auth?.secretKey)
    throw new Error("Run tcb login first.");
  return new CloudBase({
    envId,
    secretId: auth.secretId,
    secretKey: auth.secretKey,
    token: auth.token,
  });
}
module.exports = { manager, envId };

if (require.main === module)
  (async () => {
    const app = await manager();
    const command = process.argv[2] || "inspect";
    if (command === "inspect") {
      const domains = await app.env.getEnvAuthDomains();
      console.log(
        "Web domains:",
        domains.Domains.map((d) => d.Domain).join(", "),
      );
      const login = await app.env.getLoginConfigListV2();
      console.log("Anonymous login:", login.Data?.AnonymousLogin);
      for (const name of ["web_reader_sessions", "web_reader_limits"]) {
        const result = await app.database.checkCollectionExists(name);
        console.log(name, "exists:", result.Exists);
      }
    } else if (command === "setup") {
      for (const name of ["web_reader_sessions", "web_reader_limits"]) {
        await app.database.createCollectionIfNotExists(name);
        // Only server functions may access these two new collections.
        await app.commonService().call({
          Action: "ModifyDatabaseACL",
          Param: { EnvId: envId, CollectionName: name, AclTag: "ADMINONLY" },
        });
        const exists = await app.database.checkIndexExists(name, "expiresAt");
        if (!exists.Exists)
          await app.database.updateCollection(name, {
            CreateIndexes: [
              {
                IndexName: "expiresAt",
                MgoKeySchema: {
                  MgoIndexKeys: [{ Name: "expiresAt", Direction: "1" }],
                  MgoIsUnique: false,
                },
              },
            ],
          });
        console.log(name, "ready (server-only, expiry index)");
      }
    } else throw new Error("Supported commands: inspect, setup");
  })().catch((error) => {
    console.error(error.code || error.name, error.message);
    process.exitCode = 1;
  });
