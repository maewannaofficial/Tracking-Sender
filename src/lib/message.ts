export function buildTrackingMessage(order: {
  customer_name: string;
  tracking_no: string;
  cod_amount: number;
}) {
  const codText =
    order.cod_amount === 0
      ? "ไม่มี"
      : `${order.cod_amount.toLocaleString("th-TH")} บาท`;

  return `ร้านบ้านรวมทะเลจัดส่งสินค้าแล้วครับ 📦

ชื่อผู้รับ: ${order.customer_name}
เช็คสถานะพัสดุ:
https://www.flashexpress.co.th/fle/tracking?se=${order.tracking_no}

ยอดชำระปลายทาง: ${codText}

ขอบคุณที่อุดหนุนนะครับ 🙏🏻
ได้รับสินค้าแล้วอย่าลืมมารีวิวให้ทางร้านด้วยนะครับ`;
}
