const PACKAGE_NAME = "@domovoid/core";
const ENCODED_PACKAGE_NAME = PACKAGE_NAME.replace("/", "%2F");

export async function checkForUpdate(
  currentVersion: string,
  registryUrl: string,
): Promise<{ updateAvailable: boolean; latest: string; current: string }> {
  const response = await fetch(`${registryUrl}/${ENCODED_PACKAGE_NAME}/latest`);
  if (!response.ok) {
    throw new Error(`Registry returned ${String(response.status)}`);
  }
  const { version: latest } = (await response.json()) as { version: string };
  return { updateAvailable: latest !== currentVersion, latest, current: currentVersion };
}
