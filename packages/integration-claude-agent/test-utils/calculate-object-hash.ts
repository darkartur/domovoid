export default async function calculateObjectHash(value: object): Promise<string> {
  const stringValue = JSON.stringify(value);
  const messageUint8 = new TextEncoder().encode(stringValue);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageUint8);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
