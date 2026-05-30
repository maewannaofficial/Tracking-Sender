# Tracking Sender Dashboard

เว็บหลังบ้านสำหรับร้านบ้านรวมทะเล มี 2 ส่วน:

- `/dashboard` ใช้ดึงชื่อ FB และข้อความจาก Google Sheet, เลือก Zernio conversation, preview และกดยืนยันส่งข้อความแจ้งพัสดุ
- `/intelligence` ใช้ดู Social Commerce Intelligence จาก Zernio Ads/Analytics พร้อมข้อมูลตัวอย่าง fallback เมื่อยังไม่ได้ต่อ API จริง

## Setup

1. ติดตั้ง dependency

```bash
npm install
```

2. สร้าง `.env.local` จาก `.env.local.example`

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
GOOGLE_SHEET_NAME=tracking_messages
ZERNIO_API_KEY=
ZERNIO_ACCOUNT_ID=
ZERNIO_PLATFORM=facebook
ZERNIO_MESSAGE_TAG=POST_PURCHASE_UPDATE
ADMIN_PASSWORD=
AUTH_SECRET=
```

บน Vercel ให้เก็บ `GOOGLE_PRIVATE_KEY` เป็นค่าเดียวที่มี `\n` หรือ newline ตามที่ Google service account ให้มา แอปจะแปลง `\n` ให้เองตอนสร้าง client

3. ตั้งค่า Google Sheet

สร้าง sheet ชื่อ `tracking_messages` แบบง่ายตามรูป โดยใช้คอลัมน์หลัก:

```text
FB Name | ยอดปลายทาง (ถ้ามี) | ข้อความ
```

คอลัมน์ข้อความจะตั้งหัวว่า `ข้อความ`, `message`, หรือปล่อยหัวคอลัมน์ว่างแบบในรูปก็ได้ ถ้ามี `FB Name` และ `ยอดปลายทาง (ถ้ามี)` ระบบจะอ่านคอลัมน์ถัดไปเป็นข้อความให้อัตโนมัติ

ถ้าต้องการให้ระบบบันทึกสถานะกลับ Sheet ค่อยเพิ่มคอลัมน์ optional เหล่านี้ภายหลัง:

```text
conversation_id, Status, sent_at, error
```

แชร์ไฟล์ Sheet ให้ service account email ด้วยสิทธิ์ editor

4. ตั้งค่า Zernio

เชื่อม Facebook/Instagram inbox ของร้านใน Zernio แล้วสร้าง API key จาก Zernio จากนั้นใส่ค่า:

```env
ZERNIO_API_KEY=
ZERNIO_ACCOUNT_ID=
ZERNIO_AD_ACCOUNT_ID=
ZERNIO_PLATFORM=facebook
```

แอปใช้ endpoint หลัก:

```text
GET /v1/inbox/conversations
POST /v1/inbox/conversations/{conversationId}/messages
GET /v1/ads/campaigns
GET /v1/analytics
```

ระบบไม่จับคู่ทั้งหมดอัตโนมัติแล้ว แอดมินกดเลือก conversation เฉพาะรายที่ต้องส่ง ถ้า matching จากชื่อไม่พอ หน้า dashboard รองรับการกรอก `conversationId` เองผ่าน manual selection

หน้า Intelligence ใช้ `GET /v1/ads/campaigns` สำหรับ campaign metrics และ `GET /v1/analytics` สำหรับ post analytics ถ้ายังไม่มี `ZERNIO_API_KEY` หรือ Zernio ยังไม่มีข้อมูลในช่วงวันที่ ระบบจะแสดง mock data พร้อมแจ้งว่าเป็นข้อมูลตัวอย่าง

`ZERNIO_ACCOUNT_ID` คือ social/page account สำหรับ post analytics ส่วน `ZERNIO_AD_ACCOUNT_ID` คือ Zernio account id ของ ad account ถ้าไม่ใส่ ระบบจะไม่ส่ง account filter ไปที่ `/v1/ads/campaigns` เพื่อกันกรองแคมเปญหายเมื่อ social account กับ ad account เป็นคนละ id

## Local Development

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000) แล้ว login ด้วย `ADMIN_PASSWORD`

หลัง login:

- Tracking Sender: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- Social Commerce Intelligence: [http://localhost:3000/intelligence](http://localhost:3000/intelligence)

## Verification

```bash
npm test
npm run lint
npm run build
```

## Safety Notes

- API keys อยู่ฝั่ง server เท่านั้น
- `/dashboard` และ `/api/*` ตรวจ httpOnly session cookie
- `POST /api/send-message` reread row จาก Google Sheet ก่อนส่งทุกครั้ง
- ระบบกันส่งซ้ำเมื่อมีคอลัมน์ `Status` และค่านั้นเป็น `sent`
- ถ้าส่งไม่สำเร็จ ระบบเขียน `Status = failed` และบันทึก error กลับไปที่ Sheet เฉพาะเมื่อมีคอลัมน์เหล่านั้นอยู่
