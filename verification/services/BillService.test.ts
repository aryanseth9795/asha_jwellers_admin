jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn(async () => ({ uri: "file:///cache/Print/random.pdf" })),
  printAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock("expo-asset", () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  deleteAsync: jest.fn(async () => undefined),
  moveAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(),
}));

import * as Print from "expo-print";
import { printBill, sharePdf } from "../../src/services/BillService";

const printToFileAsync = Print.printToFileAsync as jest.Mock;
const printAsync = Print.printAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("BillService", () => {
  it("prints the same A5 PDF that sharing makes, not the raw HTML", async () => {
    await printBill("<html>bill</html>");
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<html>bill</html>", width: 420, height: 595 }),
    );
    expect(printAsync).toHaveBeenCalledWith({ uri: "file:///cache/Print/random.pdf" });
  });

  it("shares an A5 PDF", async () => {
    await sharePdf("<html>bill</html>", 9267);
    expect(printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<html>bill</html>", width: 420, height: 595 }),
    );
  });
});
