import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../types/entry";

export type UserTransactionsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "UserTransactions"
>;

export type UserTransactionsRouteProp = RouteProp<
  RootStackParamList,
  "UserTransactions"
>;

export interface Props {
  navigation: UserTransactionsNavigationProp;
  route: UserTransactionsRouteProp;
}
