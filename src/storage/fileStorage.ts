import {
  documentDirectory,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
} from "expo-file-system/legacy";

// Get app's document directory for storing images
const getImageDirectory = () => {
  return `${documentDirectory}images/`;
};

// Ensure image directory exists
const ensureDirectoryExists = async () => {
  const dir = getImageDirectory();
  try {
    await makeDirectoryAsync(dir, { intermediates: true });
  } catch (error) {
    // Directory might already exist, which is fine
  }
};

// Save images to local storage and return new paths
export const saveImages = async (imageUris: string[]): Promise<string[]> => {
  await ensureDirectoryExists();

  const savedPaths: string[] = [];

  for (const uri of imageUris) {
    const filename = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.jpg`;
    const newPath = `${getImageDirectory()}${filename}`;

    try {
      await copyAsync({
        from: uri,
        to: newPath,
      });
      savedPaths.push(newPath);
    } catch (error) {
      console.error("Error saving image:", error);
    }
  }

  return savedPaths;
};

// Delete image file
export const deleteImage = async (path: string): Promise<void> => {
  try {
    await deleteAsync(path, { idempotent: true });
  } catch (error) {
    console.error("Error deleting image:", error);
  }
};

// Delete multiple images
export const deleteImages = async (paths: string[]): Promise<void> => {
  for (const path of paths) {
    await deleteImage(path);
  }
};
