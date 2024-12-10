import { sepolia } from "viem/chains";
import { config } from "dotenv";

config();

export const pimlicoSepoliaUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`;
export const rpcURL = (process.env.RPC_URL as string) ?? "https://sepolia.drpc.org";
export const automationsApiKey = process.env.AUTOMATIONS_API_KEY as string;
export const privateKey = process.env.PRIVATE_KEY as string;

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required");
} else if (process.env.PIMLICO_API_KEY === undefined) {
  throw new Error("PIMLICO_API_KEY is required");
}

