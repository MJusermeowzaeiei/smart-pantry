# Smart Pantry — Web Push บน iPhone

ชุดปรับปรุงนี้เพิ่ม PWA, Service Worker, Web Push และระบบตรวจวันหมดอายุฝั่งเซิร์ฟเวอร์ โดยยังคงหน้าเว็บ GitHub Pages เดิม

## ไฟล์ที่เพิ่ม/เปลี่ยน

- `manifest.webmanifest` — ทำให้เว็บติดตั้งเป็น Web App ได้
- `icon.svg` — ไอคอนแอป
- `sw.js` — รับ Web Push และแสดงการแจ้งเตือนแม้หน้าเว็บไม่ได้เปิดอยู่
- `cloudflare-worker/worker.js` — API สำหรับสมัครรับ Push, ซิงก์วันหมดอายุ และ Cron ตรวจรายการทุกวัน
- `cloudflare-worker/wrangler.toml` — การตั้งค่า Cloudflare Worker, KV และเวลา Cron
- `cloudflare-worker/package.json` — dependency สำหรับเข้ารหัส Web Push
- `index.html` — สมัคร Push, ซิงก์รายการ และทดสอบการแจ้งเตือน

## ภาพรวมการทำงาน

1. ผู้ใช้เพิ่มเว็บไปยัง Home Screen ของ iPhone และกดเปิดการแจ้งเตือนในแอป
2. เบราว์เซอร์สร้าง Push subscription และส่งไปเก็บใน Cloudflare KV
3. รายการชื่อวัตถุดิบกับวันหมดอายุถูกซิงก์ไปยัง KV เพื่อให้เซิร์ฟเวอร์ตรวจได้ตอนปิดเว็บ
4. Cron ทำงานทุกวันเวลา 08:00 น. ประเทศไทย (01:00 UTC) และส่ง Push หากหมดอายุหรือเหลือไม่เกิน 3 วัน

**ข้อสำคัญ:** GitHub Pages เพียงอย่างเดียวไม่สามารถทำงานเบื้องหลังตามเวลาได้ จึงต้องตั้งค่า Cloudflare Worker ให้เสร็จด้วย

## ตั้งค่าครั้งแรก

### 1. เตรียมเครื่องมือและ Cloudflare

ต้องมีบัญชี Cloudflare และ Node.js ติดตั้งบนคอมพิวเตอร์

เปิด Terminal/PowerShell แล้วทำตามนี้:

```bash
cd cloudflare-worker
npm install
npx wrangler login
```

### 2. สร้าง KV สำหรับเก็บข้อมูล

```bash
npx wrangler kv namespace create PANTRY_KV
```

คำสั่งจะแสดง `id` ของ namespace ให้คัดลอกไปแทนที่ `REPLACE_WITH_KV_NAMESPACE_ID` ในไฟล์ `cloudflare-worker/wrangler.toml` จากนั้นบันทึกไฟล์

### 3. สร้าง VAPID keys

สร้างกุญแจ VAPID สำหรับ Web Push โดยใช้คำสั่ง:

```bash
npx --yes web-push generate-vapid-keys
```

เก็บทั้ง **Public Key** และ **Private Key** ไว้ให้ดี ห้ามเผยแพร่ Private Key ใน GitHub หรือในหน้าเว็บ

ตั้งค่า secrets ให้ Worker ทีละรายการ:

```bash
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

เมื่อแต่ละคำสั่งถามค่า ให้กรอก:
- `VAPID_SUBJECT`: อีเมลสำหรับติดต่อ เช่น `mailto:your-email@example.com`
- `VAPID_PUBLIC_KEY`: Public Key ที่สร้างไว้
- `VAPID_PRIVATE_KEY`: Private Key ที่สร้างไว้

### 4. Deploy Worker

จากโฟลเดอร์ `cloudflare-worker`:

```bash
npx wrangler deploy
```

เมื่อสำเร็จ ให้จด URL ที่ Wrangler แสดง ซึ่งมักอยู่ในรูป `https://smart-pantry-push.<ชื่อบัญชี>.workers.dev`

ทดสอบเปิด `https://<Worker-URL>/api/health` ต้องได้ JSON คล้าย `{"ok":true,"service":"Smart Pantry Web Push"}`

### 5. เชื่อมหน้าเว็บกับ Worker

ใน `index.html` ให้แก้ค่าคงที่ 2 ตัวด้านบนของ JavaScript:

```js
const PUSH_API_BASE = 'https://smart-pantry-push.<ชื่อบัญชี>.workers.dev';
const VAPID_PUBLIC_KEY = '<VAPID_PUBLIC_KEY>';
```

- `PUSH_API_BASE` ต้องเป็น URL Worker จริง โดยไม่มีเครื่องหมาย `/` ปิดท้าย
- `VAPID_PUBLIC_KEY` ใช้ Public Key ชุดเดียวกับที่ตั้งใน Worker
- ห้ามใส่ Private Key ใน `index.html`

จากนั้น commit/push การเปลี่ยนแปลงขึ้น GitHub และรวมเข้า branch ที่ GitHub Pages ใช้เผยแพร่ (โดยทั่วไปคือ `main`) รอให้ GitHub Pages deploy เสร็จ

### 6. เปิดใช้บน iPhone

1. อัปเดต iOS ให้เป็นเวอร์ชันที่รองรับ Web Push (iOS/iPadOS 16.4 ขึ้นไป)
2. เปิดลิงก์ GitHub Pages ด้วย **Safari**
3. แตะ Share → **Add to Home Screen** → Add
4. เปิด Smart Pantry จากไอคอนบน Home Screen ไม่ใช่จากแท็บ Safari
5. กด **เปิดการแจ้งเตือนบนอุปกรณ์** และอนุญาตการแจ้งเตือน
6. กด **ทดสอบการแจ้งเตือน** ควรมีการแจ้งเตือนเข้ามา
7. เพิ่มวัตถุดิบที่หมดอายุในอีก 1–3 วันเพื่อทดสอบรอบ Cron ถัดไป

## ข้อจำกัดและความเป็นส่วนตัว

- Cloudflare Free มีโควตาการใช้งานและอาจเปลี่ยนแปลงได้ ควรตรวจ dashboard ก่อนใช้งานจริง
- การแจ้งเตือนตามเวลาไม่ใช่แบบทันทีเสมอไป: Cron ตรวจวันละครั้งเวลา 08:00 น. เวลาไทย
- ต้องมีอินเทอร์เน็ต, ผู้ใช้อนุญาต Notifications, และไม่ปิดการแจ้งเตือนของแอปใน iOS
- ข้อมูลเดิมอยู่ใน localStorage ของเบราว์เซอร์ ข้อมูลจะซิงก์ไป Cloudflare KV หลังสมัคร Web Push แล้วเท่านั้น ข้อมูลที่ซิงก์ ได้แก่ ID, ชื่อวัตถุดิบ และวันหมดอายุ
- ถ้าเปิดเว็บคนละอุปกรณ์ จะเป็นคนละคลัง/คนละ user ID ในเวอร์ชันนี้ และยังไม่มีระบบบัญชีหรือการกู้คืน subscription
- Worker นี้เป็นต้นแบบโครงงาน ยังไม่มีระบบ login; user ID แบบสุ่มช่วยลดโอกาสเดา ID แต่ไม่ใช่ระบบยืนยันตัวตนเต็มรูปแบบ จึงไม่ควรเก็บข้อมูลอ่อนไหว
- หากเปลี่ยน Worker URL หลังจากสมัครแล้ว ให้ตรวจค่าตั้งค่าและสมัคร Web Push ใหม่ตามความจำเป็น
- การแจ้งเตือนเป็นตัวช่วยเตือนตามวันที่ผู้ใช้กรอก ไม่ใช่การตรวจสอบความปลอดภัยของอาหาร

## แหล่งข้อมูล

- Apple — Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple Developer — Sending web push notifications: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Cloudflare Workers — https://developers.cloudflare.com/workers/
- @block65/webcrypto-web-push — https://github.com/block65/webcrypto-web-push
