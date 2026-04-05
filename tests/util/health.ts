export async function healthJson(): Promise<{ status: string; version: string } | undefined> {
  try {
    const response = await fetch("http://127.0.0.1:7777/health");
    return (await response.json()) as { status: string; version: string };
  } catch {
    return undefined;
  }
}
