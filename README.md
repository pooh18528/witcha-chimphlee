# คลังประวัติการประชุมและระบบสแกนค้นหาบุคคลด้วย OpenCV & Face Recognition (Security Tracking System)
### รศ.ดร.วิชชา ฉิมพลี | มหาวิทยาลัยสวนดุสิต

🔗 **GitHub Repository Link**: [https://github.com/pooh18528/witcha-chimphlee](https://github.com/pooh18528/witcha-chimphlee)

---

## 📌 รายงานสรุปผลงานและการตรวจเช็กระบบ (Project Overview & Summary)

โปรเจกต์นี้ได้รับการพัฒนาขึ้นเพื่อเป็นคลังประวัติการประชุม กิจกรรม และระบบติดตามค้นหาบุคคล/ผู้ต้องสงสัยด้วยคอมพิวเตอร์วิชั่น (**OpenCV & Face Recognition**) รองรับการประยุกต์ใช้งานในงานด้านความมั่นคงและติดตามผู้ต้องสงสัย (Security Surveillance & Suspect Tracking)

---

## 📊 รายงานสถิติและความแม่นยำในการดึงข้อมูล (Image Retrieval Accuracy Statistics)

การวัดความแม่นยำในการดึงข้อมูลภาพ (Image Retrieval Accuracy) จากแหล่งข้อมูลประวัติการประชุม:

- **จำนวน URL ภาพเป้าหมายทั้งหมดในระบบ**: `3,693` ภาพ
- **จำนวนภาพที่ดึงข้อมูลและดาวน์โหลดสำเร็จ (Web Scraping)**: `2,414` ภาพ
- **อัตราความแม่นยำในการดึงข้อมูลภาพ (Image Retrieval Accuracy Rate)**: **`65.37%`**
- **จำนวนภาพบันทึกเหตุการณ์ท้องถิ่นเพิ่มเติม (Local Archives)**: `577` ภาพ
- **รวมจำนวนภาพทั้งหมดในคลังระบบ**: **`2,991` ภาพ**
- **จำนวนใบหน้าที่ตรวจจับและลงพิกัดล่วงหน้าด้วย OpenCV**: **`4,381` ใบหน้า** (จาก 3,002 ไฟล์ภาพ)

---

## 🎯 รายละเอียดการทำงานของระบบ (Security & Suspect Tracking Features)

ระบบรองรับการประยุกต์ใช้ในงานความมั่นคงเพื่อติดตามผู้ต้องสงสัยและบุคคลเป้าหมายด้วย **OpenCV & AI Deep Learning** โดยมีฟีเจอร์ครบถ้วนตามข้อกำหนดดังนี้:

| ฟีเจอร์ (Feature) | รายละเอียดและหลักการทำงาน |
| :--- | :--- |
| **1. Input Upload ใบหน้า** | อัปโหลดรูปภาพใบหน้าผู้ต้องสงสัย/บุคคลที่ต้องการค้นหาผ่านหน้าเว็บ (รองรับ Drag & Drop และไฟล์ภาพทุกชนิด) |
| **2. ค้นหาในคลังภาพ/อินเทอร์เน็ต** | สกัดเวกเตอร์ลักษณะใบหน้า (Face Descriptors) แล้วเปรียบเทียบกับคลังภาพการประชุมทั้งหมด 2,991 ภาพ |
| **3. แสดงภาพถ่ายกิจกรรม** | แสดงการ์ดผลลัพธ์ภาพถ่ายกิจกรรมและงานประชุมที่มีบุคคลเป้าหมายปรากฏตัวอยู่ |
| **4. แสดงรายละเอียด Security Metadata** | ระบุ **ชื่องานประชุม/สัมมนา**, **วันที่และเวลาที่เกิดเหตุการณ์**, และ **หมวดหมู่สถานที่** เพื่อใช้ตามสืบพิกัด |
| **5. วาดวงกลมล้อมใบหน้า (Green Circle)** | วาดวงกลมสีเขียว (Green Bounding Circle) ไฮไลท์ตำแหน่งพิกัดใบหน้าของบุคคลนั้นบนภาพอย่างแม่นยำ |
| **6. นับจำนวนคนในภาพ (People Counter)** | คำนวณและแสดงจำนวนคนทั้งหมดที่อยู่ในภาพนั้นๆ (`People Count per Frame`) สำหรับวิเคราะห์สถานการณ์ |

---

## 👁️‍🗨️ การประมวลผลด้าน Computer Vision (OpenCV & Face Recognition)

1. **การประมวลผลด้วย OpenCV ในสคริปต์ Python (`scripts/detect_faces.py` & `scripts/opencv_suspect_tracker.py`)**:
   - ใช้ **OpenCV (`cv2.CascadeClassifier`)** ร่วมกับ `haarcascade_frontalface_default.xml`
   - ตรวจหาพิกัดใบหน้า (`x, y, w, h`) และนับจำนวนคนในภาพล่วงหน้า
   - บันทึกโครงสร้างข้อมูลลงใน JSON (`public/face_data/face_locations.json`) เพื่อประสิทธิภาพสูงสุดในการค้นหาระดับ Real-time

2. **การประมวลผล Face Feature Vector บน Web Frontend (`src/face-search.js`)**:
   - ใช้ **`@vladmandic/face-api`** สกัดใบหน้าและแปลงเป็น 128-dimensional Face Feature Vector
   - เปรียบเทียบระยะห่างทางคณิตศาสตร์ (Euclidean Distance / Cosine Similarity) เพื่อระบุตัวตนบุคคลเป้าหมาย

---

## 🛠️ ขั้นตอนการดาวน์โหลดและรันโปรเจกต์สำหรับผู้ตรวจ (Instructions for Evaluator / Professor)

### 1. Clone โปรเจกต์จาก GitHub
```bash
git clone https://github.com/pooh18528/witcha-chimphlee.git
cd witcha-chimphlee
```

### 2. ติดตั้ง Dependencies (Node.js)
```bash
npm install
```

### 3. รันเว็บแอปพลิเคชัน (Development Server)
```bash
npm run dev
```
เปิดเว็บเบราว์เซอร์ที่: **`http://localhost:5173`**

> **หมายเหตุ**: ระบบจะคัดลอกภาพจาก `dist/` ไปยัง `public/` อัตโนมัติเมื่อรัน `npm run dev` (ผ่าน `predev` script) รองรับทั้ง Windows, macOS, และ Linux

### 4. (ทางเลือก) รันสคริปต์สแกนใบหน้า OpenCV บน Python
```bash
pip install -r requirements.txt
python scripts/detect_faces.py
python scripts/opencv_suspect_tracker.py
```

---

## 💻 เทคโนโลยีที่ใช้ (Tech Stack)
- **Computer Vision & AI**: OpenCV (`cv2`), `@vladmandic/face-api` (Tiny Face Detector, Facial Landmarks, Recognition)
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism Design UI), JavaScript ES Modules
- **Build Tool**: Vite
- **Data & Data Science**: Python 3, NumPy, JSON Datasets

---

## 📜 License
MIT License — © 2569 (2026) รศ.ดร.วิชชา ฉิมพลี | มหาวิทยาลัยสวนดุสิต
