import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { zip } from "react-native-zip-archive";
import {
  getAllUsers,
  getAllRehan,
  getAllLenden,
} from "../database/entryDatabase";
import { Rehan, Lenden } from "../types/entry";

const EXPORT_DIR_NAME = "aj_export";

export const exportData = async (): Promise<void> => {
  try {
    // 1. Prepare export directory
    const exportDir = `${FileSystem.documentDirectory}${EXPORT_DIR_NAME}`;
    const imagesDir = `${exportDir}/images`;

    // Clean up previous export if exists
    const dirInfo = await FileSystem.getInfoAsync(exportDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(exportDir, { idempotent: true });
    }

    // Create directories
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });

    // 2. Fetch all data
    const users = await getAllUsers();
    const rehan = await getAllRehan();
    const lenden = await getAllLenden();

    // 3. Process data and copy images
    const processedRehan = await processEntries(rehan, imagesDir);
    const processedLenden = await processEntries(lenden, imagesDir);

    // 4. Write JSON files
    await FileSystem.writeAsStringAsync(
      `${exportDir}/users.json`,
      JSON.stringify(users, null, 2)
    );
    await FileSystem.writeAsStringAsync(
      `${exportDir}/rehan.json`,
      JSON.stringify(processedRehan, null, 2)
    );
    await FileSystem.writeAsStringAsync(
      `${exportDir}/lenden.json`,
      JSON.stringify(processedLenden, null, 2)
    );

    // 5. Zip the directory
    const zipPath = `${FileSystem.documentDirectory}export_${Date.now()}.zip`;
    await zip(exportDir, zipPath);

    // 6. Share the zip file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(zipPath);
    } else {
      throw new Error("Sharing is not available on this device");
    }

    // 7. Cleanup
    await FileSystem.deleteAsync(exportDir, { idempotent: true });
    // Optional: Delete zip after sharing? Expo sharing might need it.
    // Usually, we can leave the zip for a while or delete it next time.
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
};

const processEntries = async (
  entries: (Rehan | Lenden)[],
  targetImagesDir: string
) => {
  const processed = [];

  for (const entry of entries) {
    const rawMedia = JSON.parse(entry.media);
    const newMediaPaths = [];

    if (Array.isArray(rawMedia)) {
      for (const mediaPath of rawMedia) {
        if (typeof mediaPath === "string") {
          // Extract filename
          const filename = mediaPath.split("/").pop();
          if (filename) {
            const destPath = `${targetImagesDir}/${filename}`;

            // Copy file if it exists
            const fileInfo = await FileSystem.getInfoAsync(mediaPath);
            if (fileInfo.exists) {
              await FileSystem.copyAsync({
                from: mediaPath,
                to: destPath,
              });
              // Store relative path for DB portability
              newMediaPaths.push(`images/${filename}`);
            } else {
              console.warn(`Image not found: ${mediaPath}`);
              // Keep original path or mark missing? Let's keep original just in case
              newMediaPaths.push(mediaPath);
            }
          }
        }
      }
    }

    processed.push({
      ...entry,
      media: JSON.stringify(newMediaPaths), // Update media with relative paths
      originalMedia: entry.media, // Optional: keep original paths reference
    });
  }

  return processed;
};
