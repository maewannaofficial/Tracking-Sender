import { describe, expect, it } from "vitest";

import {
  extractGoogleSheetGid,
  extractGoogleSheetId,
  filterOrdersByStatus,
  formatSheetRange,
  normalizePrivateKey,
  normalizeSheetRows,
} from "./googleSheets";

describe("Google Sheets env parsing", () => {
  it("extracts spreadsheet id from pasted edit URLs or partial edit paths", () => {
    expect(
      extractGoogleSheetId(
        "https://docs.google.com/spreadsheets/d/1TvMjoDcneHTFTstQMOkMiabV4mgIn_mAbDU9Juyl7AA/edit?gid=2045394531#gid=2045394531",
      ),
    ).toBe("1TvMjoDcneHTFTstQMOkMiabV4mgIn_mAbDU9Juyl7AA");
    expect(
      extractGoogleSheetId(" 1TvMjoDcneHTFTstQMOkMiabV4mgIn_mAbDU9Juyl7AA/edit?gid=2045394531 "),
    ).toBe("1TvMjoDcneHTFTstQMOkMiabV4mgIn_mAbDU9Juyl7AA");
  });

  it("extracts gid and normalizes quoted private keys from env files", () => {
    expect(extractGoogleSheetGid("sheet-id/edit?gid=2045394531#gid=2045394531")).toBe(2045394531);
    expect(normalizePrivateKey('"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"')).toBe(
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
    );
  });

  it("normalizes quoted scalar env values", () => {
    expect(normalizePrivateKey('"service@example.iam.gserviceaccount.com"')).toBe(
      "service@example.iam.gserviceaccount.com",
    );
  });

  it("quotes sheet names with spaces or Thai characters in ranges", () => {
    expect(formatSheetRange("tracking_messages", "A:K")).toBe("tracking_messages!A:K");
    expect(formatSheetRange("แจกเลขพัสดุ Flash", "A:K")).toBe("'แจกเลขพัสดุ Flash'!A:K");
  });
});

describe("normalizeSheetRows", () => {
  it("supports the simple sheet layout from the screenshot: FB Name, optional COD, and message", () => {
    const rows = [
      ["", "FB Name", "ยอดปลายทาง (ถ้ามี)", ""],
      [
        "",
        "ABC",
        "30",
        "ร้านบ้านรวมทะเลจัดส่งสินค้าแล้วครับ 📦\n\nชื่อ : ABC\nยอดชำระปลายทาง : 30 บาท",
      ],
    ];

    const orders = normalizeSheetRows(rows);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      rowNumber: 2,
      id: "2",
      fb_name: "ABC",
      customer_name: "ABC",
      cod_amount: 30,
      message: "ร้านบ้านรวมทะเลจัดส่งสินค้าแล้วครับ 📦\n\nชื่อ : ABC\nยอดชำระปลายทาง : 30 บาท",
      match_status: "pending",
      send_status: "pending",
    });
  });

  it("falls back to the customer name inside the message when FB Name is blank", () => {
    const rows = [
      ["Link", "FB Name", "ยอดปลายทาง (ถ้ามี)", ""],
      [
        "",
        "",
        "",
        "ร้านบ้านรวมทะเลจัดส่งสินค้าแล้วครับ 📦\n\nเช็คสถานะ : https://example.com\nชื่อ : ABC\nยอดชำระปลายทาง : 30 บาท",
      ],
    ];

    expect(normalizeSheetRows(rows)[0]).toMatchObject({
      fb_name: "ABC",
      customer_name: "ABC",
      cod_amount: 30,
    });
  });

  it("does not treat the next line as a customer name when the name line is blank", () => {
    const rows = [
      ["Link", "FB Name", "ยอดปลายทาง (ถ้ามี)", ""],
      ["", "", "", "เช็คสถานะ : https://example.com\nชื่อ :\nยอดชำระปลายทาง : ไม่มี"],
    ];

    expect(normalizeSheetRows(rows)[0]).toMatchObject({
      fb_name: "",
      customer_name: "",
    });
  });

  it("maps sheet values into tracking orders with row numbers and generated fallback messages", () => {
    const rows = [
      [
        "id",
        "fb_name",
        "tracking_no",
        "customer_name",
        "cod_amount",
        "message",
        "subscriber_id",
        "match_status",
        "send_status",
        "sent_at",
        "error",
      ],
      ["1", "Nan Napat", "TH123456789", "คุณแนน", "0", "", "", "", "", "", ""],
    ];

    const orders = normalizeSheetRows(rows);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      rowNumber: 2,
      id: "1",
      cod_amount: 0,
      match_status: "pending",
      send_status: "pending",
    });
    expect(orders[0].message).toContain("TH123456789");
  });

  it("preserves a sheet-provided message instead of rebuilding it", () => {
    const rows = [
      ["id", "fb_name", "tracking_no", "customer_name", "cod_amount", "message"],
      ["1", "Nan Napat", "TH123456789", "คุณแนน", "0", "custom message"],
    ];

    expect(normalizeSheetRows(rows)[0].message).toBe("custom message");
  });
});

describe("filterOrdersByStatus", () => {
  it("returns pending and failed rows by default and honors explicit filters", () => {
    const orders = normalizeSheetRows([
      ["id", "fb_name", "tracking_no", "customer_name", "cod_amount", "message", "subscriber_id", "match_status", "send_status"],
      ["1", "A", "TH1", "A", "0", "", "", "pending", "pending"],
      ["2", "B", "TH2", "B", "0", "", "", "not_found", "failed"],
      ["3", "C", "TH3", "C", "0", "", "123", "matched", "sent"],
    ]);

    expect(filterOrdersByStatus(orders).map((order) => order.id)).toEqual(["1", "2"]);
    expect(filterOrdersByStatus(orders, "sent").map((order) => order.id)).toEqual(["3"]);
    expect(filterOrdersByStatus(orders, "not_found").map((order) => order.id)).toEqual(["2"]);
    expect(filterOrdersByStatus(orders, "all")).toHaveLength(3);
  });
});
