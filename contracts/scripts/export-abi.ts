import { mkdir, writeFile } from "node:fs/promises";
import { artifacts } from "hardhat";

async function main() {
  const artifact = await artifacts.readArtifact("GenesisLocker");
  await mkdir("abi", { recursive: true });
  await writeFile("abi/GenesisLocker.json", JSON.stringify(artifact.abi, null, 2));
  console.log("Exported abi/GenesisLocker.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
