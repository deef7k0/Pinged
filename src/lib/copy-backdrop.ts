import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * What a physical copy's page stands on — the game's colours moving slowly
 * behind it (reacticx's mesh gradient), or the app's plain page — the owner's
 * (2026-11-02): "Add a button at the top of the page to make the background
 * this mesh or app default." Kept on the device per account, as the review
 * page's colours are; the mesh by default, so only "plain" is stored.
 */

const PREFIX = 'gamelog:copy-backdrop';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** True unless this account chose the plain page. */
export async function loadCopyMesh(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== 'plain';
  } catch {
    return true;
  }
}

export async function saveCopyMesh(userId: string, mesh: boolean): Promise<void> {
  try {
    if (mesh) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), 'plain');
  } catch {
    /* Ignored — worst case the next copy opens on the mesh. */
  }
}
