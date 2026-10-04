import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../types/entry";

export type AddEditProductNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddEditProduct"
>;

export type AddEditProductRouteProp = RouteProp<
  RootStackParamList,
  "AddEditProduct"
>;

export interface Props {
  navigation: AddEditProductNavigationProp;
  route: AddEditProductRouteProp;
}

export interface LocalVariant {
  _id?: string;
  size: string;
  weight: string;
  images: any[]; // mixed strings (urls) and objects (files)
  isNew?: boolean;
}

export interface FormErrors {
  name?: string;
  category?: string;
  variant?: string;
}
