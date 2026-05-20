import { describe, expect, it } from "vitest";

import { buildTrackingMessage } from "./message";

describe("buildTrackingMessage", () => {
  it("uses Thai no-COD text when cod amount is zero", () => {
    const message = buildTrackingMessage({
      customer_name: "คุณแนน",
      tracking_no: "TH123456789",
      cod_amount: 0,
    });

    expect(message).toContain("ชื่อผู้รับ: คุณแนน");
    expect(message).toContain("https://www.flashexpress.co.th/fle/tracking?se=TH123456789");
    expect(message).toContain("ยอดชำระปลายทาง: ไม่มี");
  });

  it("formats COD amount with Thai locale thousands separators", () => {
    const message = buildTrackingMessage({
      customer_name: "คุณสมชาย",
      tracking_no: "TH987654321",
      cod_amount: 12500,
    });

    expect(message).toContain("ยอดชำระปลายทาง: 12,500 บาท");
  });
});
