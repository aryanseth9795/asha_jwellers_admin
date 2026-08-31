declare module "@dudigital/react-native-zoomable-view";

// React Native's require() for a bundled image returns an asset id (number),
// which is what Asset.fromModule() consumes.
declare module "*.jpg" {
  const content: number;
  export default content;
}
