import { useWindowDimensions } from "react-native";
import { Layout, layoutFor } from "./layout";

/** Live layout values; re-renders when the window width changes (fold/unfold, display size). */
export const useLayout = (): Layout => layoutFor(useWindowDimensions().width);
