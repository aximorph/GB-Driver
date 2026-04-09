# DriveLog Insights

โปรเจกต์นี้สร้างขึ้นมาด้วย Lovable AI เป็นแอปสำหรับบันทึกรายได้และรับ-จ่ายสำหรับคนขับรถ (Ride-hailing drivers)

## 🚀 วิธีการรันโปรเจกต์ (How to run)

จาก Error ที่เกิดขึ้น คุณอาจจะอยู่ในโฟลเดอร์ชั้นนอก (`drivelog-insights-main`) แทนที่จะเป็นโฟลเดอร์ที่มีโค้ดจริงๆ (`drivelog-insights-main/drivelog-insights-main`)

**ทำตามขั้นตอนต่อไปนี้ใน Terminal / Command Prompt:**

1. **เข้าไปในโฟลเดอร์ของโปรเจกต์ที่ถูกต้อง** (ที่มีไฟล์ `package.json`)
   ```bash
   cd drivelog-insights-main
   ```
   *(หมายเหตุ: หากคุณอยู่ข้างนอกสุด ต้อง `cd drivelog-insights-main\drivelog-insights-main`)*

2. **ติดตั้ง Dependencies** (ถ้ายังไม่ได้ลงหรือเพิ่งดึงโค้ดมาใหม่)
   หากคุณใช้ **npm**:
   ```bash
   npm install
   ```
   หากคุณใช้ **bun**:
   ```bash
   bun install
   ```

3. **รันเซิร์ฟเวอร์แบบ Development (เริ่มทำงาน)**
   หากคุณใช้ **npm**:
   ```bash
   npm run dev
   ```
   หากคุณใช้ **bun**:
   ```bash
   bun run dev
   ```

4. หลังจากนั้น ระบบจะขึ้น URL มาให้ (เช่น `http://localhost:5173`) ให้กด Ctrl + คลิก ที่ลิงก์นั้นเพื่อเปิดเข้าแอปบนบราวเซอร์

---

## 💻 Tech Stack
- **React.js** (Frontend)
- **Vite** (Build tool - สาเหตุที่คุณต้องรันผ่านคำสั่ง `dev` ด้านบน)
- **TypeScript**
- **Tailwind CSS** & **Shadcn UI** สำหรับ UI component
