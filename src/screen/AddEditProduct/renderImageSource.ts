// Helper to render image (url or file object)
export const renderImageSource = (img: any): any => {
  if (typeof img === "string") return { uri: img };
  if (typeof img === "object" && img.uri) return { uri: img.uri };
  return { uri: "" };
};
