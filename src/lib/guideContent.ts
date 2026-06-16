// Content for the "How to use" guide panel (HowToUseModal).
// Bilingual content lives side-by-side per section so en/th can never drift out of sync.
// This is intentionally kept OUTSIDE src/lib/i18n.ts because it's long-form, structured
// step content rather than simple UI label strings.

export interface GuideSection {
  id: string;
  emoji: string;
  title: { en: string; th: string };
  steps: { en: string; th: string }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'shift',
    emoji: '🟢',
    title: { en: 'Starting & ending a shift', th: 'เริ่มกะ & จบกะ' },
    steps: [
      {
        en: 'Tap "Start Shift" on the home screen to begin tracking. The app starts a clock for your total online time.',
        th: 'กดปุ่ม "เริ่มกะ" ที่หน้าแรกเพื่อเริ่มจับเวลา แอปจะเริ่มนับเวลาออนไลน์รวมของคุณ',
      },
      {
        en: 'While on shift you can pause anytime (e.g. taking a long break) and resume later — paused time is excluded from your online time.',
        th: 'ระหว่างอยู่ในกะ คุณสามารถกด "พัก" ได้ทุกเมื่อ (เช่น พักยาว) แล้วกดทำงานต่อได้ — เวลาที่พักจะไม่ถูกนับเป็นเวลาออนไลน์',
      },
      {
        en: 'When you\'re done, tap "End Shift". The app shows a comparison screen: what it calculated you should be paid (per platform) vs. the actual payout shown in the Grab/Bolt driver app — type that number in to see the difference.',
        th: 'เมื่อเสร็จกะ กด "จบกะ" แอปจะแสดงหน้าเปรียบเทียบ: ยอดที่แอปคำนวณว่าคุณควรได้รับ (แยกตามแพลตฟอร์ม) เทียบกับยอดโอนจริงที่เห็นในแอป Grab/Bolt — พิมพ์ตัวเลขนั้นเพื่อดูผลต่าง',
      },
      {
        en: 'The end-shift screen also shows a time breakdown: total online time, time actually working (sum of trip durations), and idle/waiting time.',
        th: 'หน้าจบกะยังแสดงสรุปเวลา: เวลาออนไลน์รวม, เวลาทำงานจริง (รวมเวลาทุกทริป), และเวลาว่าง/รอลูกค้า',
      },
    ],
  },
  {
    id: 'timer',
    emoji: '⏱️',
    title: { en: 'Trip timer & choosing platform', th: 'จับเวลาทริป & เลือกประเภทงาน' },
    steps: [
      {
        en: 'Tap the big "+" button to start a new job. This opens the trip timer, which starts counting automatically.',
        th: 'กดปุ่ม "+" ขนาดใหญ่เพื่อเริ่มงานใหม่ หน้าจับเวลาจะเปิดขึ้นมาและเริ่มนับเวลาให้อัตโนมัติ',
      },
      {
        en: 'While the timer is running, choose the platform for this job: Grab, Bolt, or VIP (your own direct customer). Your choice is remembered even if you switch apps or the screen locks.',
        th: 'ระหว่างกำลังจับเวลา ให้เลือกประเภทงานของทริปนี้: Grab, Bolt หรือ VIP (ลูกค้าตรงของคุณเอง) ระบบจะจำตัวเลือกไว้แม้สลับแอปหรือล็อกหน้าจอ',
      },
      {
        en: 'When you arrive and drop off the customer, tap "End" — the timer stops and you\'re taken straight to the income form with the trip duration and platform already filled in.',
        th: 'เมื่อส่งลูกค้าถึงที่หมายแล้ว กด "จบ" — เวลาจะหยุดนับและพาคุณไปหน้าฟอร์มบันทึกรายรับ โดยกรอกเวลาทริปและประเภทงานไว้ให้แล้ว',
      },
      {
        en: 'If you started a job by mistake, tap "Cancel" instead to discard the timer without creating any entry.',
        th: 'หากกดเริ่มงานผิด ให้กด "ยกเลิก" เพื่อล้างตัวจับเวลาโดยไม่สร้างรายการใดๆ',
      },
      {
        en: 'You can also log an expense (fuel, food, parking, etc.) directly from this screen without starting the timer at all — tap the expense option.',
        th: 'คุณยังสามารถบันทึกรายจ่าย (น้ำมัน, อาหาร, ที่จอดรถ ฯลฯ) จากหน้านี้ได้โดยตรงโดยไม่ต้องจับเวลา — กดเลือกตัวเลือกรายจ่าย',
      },
    ],
  },
  {
    id: 'income',
    emoji: '💰',
    title: { en: 'Recording income (fare, tips & deductions)', th: 'บันทึกรายรับ (ค่าโดยสาร, ทิป & ค่าหัก)' },
    steps: [
      {
        en: 'App Fare = the fare amount shown in the Grab/Bolt driver app for this trip. Customer Paid = what the customer actually paid (only different if they tipped in cash).',
        th: 'ค่าโดยสารตามแอป = ยอดค่าโดยสารที่แอป Grab/Bolt แสดงสำหรับทริปนี้ ลูกค้าจ่ายจริง = ยอดที่ลูกค้าจ่ายจริง (จะต่างกันก็ตอนลูกค้าทิปเป็นเงินสด)',
      },
      {
        en: 'Driver Received = the amount that actually landed in your pocket/wallet for this trip, after the platform\'s commission is taken out.',
        th: 'คนขับได้รับ = ยอดเงินที่เข้ากระเป๋าคุณจริงสำหรับทริปนี้ หลังจากหักค่าคอมมิชชั่นของแพลตฟอร์มแล้ว',
      },
      {
        en: 'The app automatically calculates the tip (Customer Paid − App Fare) and the app deduction/commission (App Fare − Driver Received), shown right below the fields.',
        th: 'แอปจะคำนวณทิปให้อัตโนมัติ (ลูกค้าจ่ายจริง − ค่าโดยสารตามแอป) และค่าคอมมิชชั่นที่ถูกหัก (ค่าโดยสารตามแอป − คนขับได้รับ) แสดงไว้ใต้ช่องกรอกเลย',
      },
      {
        en: 'For VIP (direct customer) or claim/misc entries, the form is simplified to just one field: the amount you received — no app fare or commission involved.',
        th: 'สำหรับงาน VIP (ลูกค้าตรง) หรือรายการเครม/อื่นๆ ฟอร์มจะเหลือแค่ช่องเดียว: ยอดที่คุณได้รับ ไม่ต้องกรอกค่าโดยสารหรือคอมมิชชั่น',
      },
      {
        en: 'You can also choose order type (Taxi/Ride or Express/Delivery) — note that Express orders and Bolt/VIP trips don\'t count toward Intensive bonuses, which the app will warn you about.',
        th: 'คุณยังเลือกประเภทออเดอร์ได้ (ไรด์/แท็กซี่ หรือ เอ็กซ์เพรส/ส่งของ) — โปรดทราบว่าออเดอร์เอ็กซ์เพรสและงาน Bolt/VIP จะไม่นับโบนัส Intensive ซึ่งแอปจะเตือนให้ทราบ',
      },
    ],
  },
  {
    id: 'payment',
    emoji: '💳',
    title: { en: 'Payment types: cash, transfer, credit', th: 'ประเภทการจ่ายเงิน: เงินสด, โอน, บัตรเครดิต' },
    steps: [
      {
        en: 'For every Grab/Bolt trip, mark how the customer paid: Cash, Transfer (QR/wallet), or Credit (card on file with the app).',
        th: 'สำหรับทุกทริป Grab/Bolt ให้เลือกวิธีที่ลูกค้าจ่ายเงิน: เงินสด, โอน (QR/วอลเล็ท), หรือบัตรเครดิต (ผูกกับแอป)',
      },
      {
        en: 'VIP trips only offer Cash or Transfer — credit card isn\'t available for direct customers since there\'s no platform processing the payment.',
        th: 'งาน VIP จะมีให้เลือกแค่เงินสดหรือโอน ไม่มีตัวเลือกบัตรเครดิต เพราะไม่มีแพลตฟอร์มกลางมาประมวลผลการจ่ายเงิน',
      },
      {
        en: 'Claim/misc entries are always marked as Credit automatically, since that money is paid out by the platform itself, not collected from a customer.',
        th: 'รายการเครม/อื่นๆ จะถูกตั้งเป็นบัตรเครดิตให้อัตโนมัติเสมอ เพราะเงินจำนวนนี้จ่ายมาจากแพลตฟอร์มเอง ไม่ได้เก็บจากลูกค้า',
      },
      {
        en: 'Why bother tagging this? On the History page, tapping your gross income shows a breakdown by payment type — handy for knowing how much cash you\'re actually holding vs. money still pending transfer/credit settlement.',
        th: 'ทำไมต้องติดแท็กนี้? เพราะในหน้าประวัติ การกดที่ยอดรายรับรวมจะแสดงสรุปแยกตามประเภทการจ่ายเงิน ช่วยให้รู้ว่าตอนนี้มีเงินสดในมือเท่าไหร่ เทียบกับเงินที่รอโอน/รอเคลียร์บัตรเครดิต',
      },
    ],
  },
  {
    id: 'claim',
    emoji: '🎁',
    title: { en: 'Claims, misc income & Intensive bonuses', th: 'เครม, รายรับอื่นๆ & โบนัส Intensive' },
    steps: [
      {
        en: 'Use the "Claim/Misc" (etc) platform option for anything that isn\'t a normal trip fare: a compensation claim, a referral bonus, a promo credit, etc.',
        th: 'ใช้ตัวเลือกประเภท "เครม/อื่นๆ" (etc) สำหรับรายรับที่ไม่ใช่ค่าโดยสารทริปปกติ เช่น ค่าชดเชยจากการเครม, โบนัสแนะนำเพื่อน, โปรโมชั่นเครดิต ฯลฯ',
      },
      {
        en: 'Intensive bonuses (tiered trip-count bonuses Grab pays for hitting daily targets) are added automatically by the app once you\'ve set them up — you don\'t need to enter them by hand.',
        th: 'โบนัส Intensive (โบนัสแบบขั้นบันไดตามจำนวนทริปที่ Grab จ่ายเมื่อทำเป้าหมายรายวันได้) แอปจะเพิ่มให้อัตโนมัติเมื่อคุณตั้งค่าไว้แล้ว — ไม่ต้องกรอกเองมือ',
      },
      {
        en: 'Set up your Intensive campaigns in Settings → Intensives: give it a name, choose which order types count (Ride / Express / All), set the daily time window and campaign date range, then add trip-count → bonus tiers.',
        th: 'ตั้งค่าแคมเปญ Intensive ของคุณได้ที่ ตั้งค่า → Intensives: ตั้งชื่อ, เลือกว่าออเดอร์ประเภทไหนนับ (ไรด์ / เอ็กซ์เพรส / ทั้งหมด), กำหนดช่วงเวลารายวันและช่วงวันที่ของแคมเปญ จากนั้นเพิ่มขั้นบันได จำนวนทริป → โบนัส',
      },
      {
        en: 'Because Intensive bonuses for a day are usually only confirmed and paid the next day, the app tracks them as "pending" and folds them into the following day\'s Grab payout comparison automatically.',
        th: 'เนื่องจากโบนัส Intensive ของแต่ละวันมักจะยืนยันและจ่ายในวันถัดไป แอปจะติดตามไว้เป็น "รอดำเนินการ" และนำไปรวมกับยอดเปรียบเทียบการจ่ายเงินของ Grab ในวันถัดไปให้อัตโนมัติ',
      },
    ],
  },
  {
    id: 'history',
    emoji: '📊',
    title: { en: 'History & income breakdown', th: 'ประวัติ & สรุปรายรับ' },
    steps: [
      {
        en: 'The History tab lets you switch between Daily, Weekly, and Monthly views to see your income, trip count, and online time over different periods.',
        th: 'แท็บประวัติให้คุณสลับมุมมองเป็นรายวัน, รายสัปดาห์, หรือรายเดือน เพื่อดูรายรับ, จำนวนทริป, และเวลาออนไลน์ในแต่ละช่วง',
      },
      {
        en: 'Tap on the gross income figure to open a popover breakdown showing how much came in as cash, transfer, credit, or unrecorded payment type.',
        th: 'กดที่ยอดรายรับรวมเพื่อเปิดสรุปแสดงว่าได้รับเป็นเงินสด, โอน, บัตรเครดิต, หรือยังไม่ระบุประเภทการจ่ายเงินเท่าไหร่',
      },
      {
        en: 'Each period also shows tips collected, total expenses, and your final net income (income minus expenses).',
        th: 'แต่ละช่วงจะแสดงทิปที่ได้รับ, รายจ่ายรวม, และรายรับสุทธิ (รายรับ หักด้วยรายจ่าย) ให้ด้วย',
      },
      {
        en: 'Tap any individual trip in the list to see its full detail, or to edit/delete it. Long-press or use the trash icon to delete an entire period\'s entries at once.',
        th: 'กดที่รายการทริปแต่ละรายการเพื่อดูรายละเอียดทั้งหมด หรือแก้ไข/ลบ กดค้างหรือใช้ไอคอนถังขยะเพื่อลบรายการทั้งหมดในช่วงนั้นได้ในครั้งเดียว',
      },
      {
        en: 'Use "Export CSV" to download your raw data for a period as a spreadsheet file.',
        th: 'ใช้ปุ่ม "Export CSV" เพื่อดาวน์โหลดข้อมูลดิบของช่วงนั้นเป็นไฟล์สเปรดชีต',
      },
    ],
  },
  {
    id: 'share',
    emoji: '📤',
    title: { en: 'Sharing an income summary card', th: 'แชร์การ์ดสรุปรายรับ' },
    steps: [
      {
        en: 'From the History page, tap "Share" on any day/week/month to generate a clean summary image — total income, payment-type breakdown, trips, and online time.',
        th: 'จากหน้าประวัติ กด "แชร์" ที่วัน/สัปดาห์/เดือนไหนก็ได้ เพื่อสร้างรูปภาพสรุปที่อ่านง่าย — รายรับรวม, สรุปแยกตามประเภทการจ่ายเงิน, จำนวนทริป, และเวลาออนไลน์',
      },
      {
        en: 'The generated image is ready to post or send directly through your phone\'s normal share sheet — to LINE, Facebook groups, or wherever you compare notes with other drivers.',
        th: 'รูปที่สร้างขึ้นพร้อมโพสต์หรือส่งได้ทันทีผ่านเมนูแชร์ปกติของโทรศัพท์ — ไปยัง LINE, กลุ่ม Facebook หรือที่ไหนก็ได้ที่คุณคุยเทียบยอดกับคนขับคนอื่น',
      },
    ],
  },
  {
    id: 'settings',
    emoji: '⚙️',
    title: { en: 'Shift settings & vehicle profile', th: 'ตั้งค่ากะ & ข้อมูลรถ' },
    steps: [
      {
        en: 'Set your vehicle type (Electric/Petrol) and fuel type in Settings — this powers automatic fuel price lookups when you log a fuel expense.',
        th: 'ตั้งค่าประเภทรถ (ไฟฟ้า/น้ำมัน) และประเภทเชื้อเพลิงในหน้าตั้งค่า — ข้อมูลนี้ใช้ดึงราคาน้ำมันอัตโนมัติเมื่อคุณบันทึกรายจ่ายค่าน้ำมัน',
      },
      {
        en: 'Choose Shift Mode: "Normal" for a shift that starts and ends the same day, or "Night" for a shift that crosses midnight (e.g. 8pm–4am) — this changes how days are grouped in History.',
        th: 'เลือกรูปแบบกะ: "ปกติ" สำหรับกะที่เริ่มและจบในวันเดียวกัน หรือ "กะดึก" สำหรับกะที่ข้ามเที่ยงคืน (เช่น 20:00–04:00) — มีผลต่อการจัดกลุ่มวันในหน้าประวัติ',
      },
      {
        en: 'Set your usual shift start/end time and a daily income goal — both are shown as a quick reference on the home screen.',
        th: 'ตั้งเวลาเริ่ม/จบกะปกติของคุณ และเป้าหมายรายรับต่อวัน — ทั้งสองค่านี้จะแสดงไว้บนหน้าแรกให้ดูได้ง่ายๆ',
      },
      {
        en: 'The "move timer" setting controls how many minutes the app waits (while you\'re idle/waiting for a job) before suggesting you move to a new spot.',
        th: 'ค่า "เวลาก่อนเตือนให้ย้ายจุด" กำหนดว่าแอปจะรอกี่นาที (ระหว่างที่คุณว่าง/รอลูกค้า) ก่อนจะแนะนำให้คุณย้ายไปจุดใหม่',
      },
      {
        en: 'Switch the app\'s display language between Thai and English anytime from Settings.',
        th: 'สลับภาษาที่ใช้แสดงในแอประหว่างไทยและอังกฤษได้ทุกเมื่อจากหน้าตั้งค่า',
      },
    ],
  },
  {
    id: 'backup',
    emoji: '☁️',
    title: { en: 'Backup & restore with Google Drive', th: 'สำรองข้อมูล & กู้คืนด้วย Google Drive' },
    steps: [
      {
        en: 'Sign in with Google from Settings to enable cloud backup — your data stays private to your own Drive account, the app only stores its own backup file there.',
        th: 'เข้าสู่ระบบด้วย Google จากหน้าตั้งค่าเพื่อเปิดใช้การสำรองข้อมูลบนคลาวด์ — ข้อมูลของคุณเป็นส่วนตัวอยู่ใน Drive ของคุณเอง แอปจะเก็บแค่ไฟล์สำรองของตัวเองไว้ที่นั่น',
      },
      {
        en: 'Tap "Backup Now" to upload all your shifts, entries, and settings. The screen shows the date/time of your last successful backup.',
        th: 'กด "สำรองข้อมูลตอนนี้" เพื่ออัปโหลดกะ, รายการ, และการตั้งค่าทั้งหมดของคุณ หน้าจอจะแสดงวันเวลาของการสำรองข้อมูลครั้งล่าสุดที่สำเร็จ',
      },
      {
        en: 'Tap "Restore" to pull your most recent backup back down — useful when switching to a new phone. You\'ll be asked to confirm since this replaces what\'s currently on the device.',
        th: 'กด "กู้คืน" เพื่อดึงข้อมูลสำรองล่าสุดกลับมา — มีประโยชน์เวลาเปลี่ยนเครื่องใหม่ ระบบจะให้คุณยืนยันก่อน เพราะการกู้คืนจะแทนที่ข้อมูลปัจจุบันในเครื่อง',
      },
      {
        en: 'You can also stay fully offline as a Guest without signing in — your data simply stays local to this device only, with no cloud backup.',
        th: 'คุณสามารถใช้งานแบบออฟไลน์ทั้งหมดในชื่อ Guest โดยไม่ต้องเข้าสู่ระบบก็ได้ — ข้อมูลจะอยู่ในเครื่องนี้เท่านั้น ไม่มีการสำรองขึ้นคลาวด์',
      },
      {
        en: '"Clear Data" in Settings permanently wipes everything on this device — use it only when you really mean to start fresh.',
        th: '"ล้างข้อมูล" ในหน้าตั้งค่าจะล้างข้อมูลทั้งหมดในเครื่องนี้อย่างถาวร — ใช้เฉพาะตอนที่ต้องการเริ่มต้นใหม่จริงๆ เท่านั้น',
      },
    ],
  },
];
