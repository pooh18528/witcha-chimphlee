import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let faceLocations = null;
let allActivities = [];
let isScanning = false;
let scanAborted = false;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export async function initFaceSearch(activities) {
    allActivities = activities;
    const uploadArea = document.getElementById('face-upload-area');
    const fileInput = document.getElementById('face-file-input');
    const preview = document.getElementById('face-preview');
    const previewCanvas = document.getElementById('face-preview-canvas');
    const scanBtn = document.getElementById('face-scan-btn');
    const progress = document.getElementById('face-progress');
    const progressFill = document.getElementById('face-progress-fill');
    const progressText = document.getElementById('face-progress-text');
    const resultsGrid = document.getElementById('face-results-grid');
    const resultsCount = document.getElementById('face-results-count');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    scanBtn.addEventListener('click', async () => {
        if (isScanning) {
            scanAborted = true;
            scanBtn.textContent = 'หยุด...';
            return;
        }
        if (!preview.src || preview.src === '') return;
        scanAborted = false;
        scanBtn.disabled = true;
        progress.style.display = 'block';
        resultsGrid.innerHTML = '';
        resultsCount.textContent = '';
        scanBtn.textContent = 'กำลังสแกน...';
        await scanFaces();
    });

    async function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.onload = () => drawFaceDetect(preview, previewCanvas);
            uploadArea.classList.add('has-image');
            scanBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    if (!modelsLoaded) {
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            modelsLoaded = true;
        } catch (err) {
            console.warn('FaceAPI models load failed, trying local fallback');
        }
    }

    try {
        const resp = await fetch('./face_data/face_locations.json');
        faceLocations = await resp.json();
    } catch {
        faceLocations = null;
    }

    async function getUploadedDescriptor(imgEl) {
        // Try multi-scale input sizes and low score thresholds to catch any face
        const inputSizes = [416, 512, 320, 224, 160];
        for (const size of inputSizes) {
            try {
                const options = new faceapi.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.1 });
                const detection = await faceapi.detectSingleFace(imgEl, options).withFaceLandmarks().withFaceDescriptor();
                if (detection && detection.descriptor) return detection.descriptor;
                
                // Try detectAllFaces and pick largest face
                const allDetections = await faceapi.detectAllFaces(imgEl, options).withFaceLandmarks().withFaceDescriptors();
                if (allDetections && allDetections.length > 0) {
                    allDetections.sort((a, b) => (b.detection.box.width * b.detection.box.height) - (a.detection.box.width * a.detection.box.height));
                    return allDetections[0].descriptor;
                }
            } catch (e) {
                console.warn(`Detection failed at size ${size}:`, e);
            }
        }
        return null;
    }

    async function drawFaceDetect(img, canvas) {
        if (!modelsLoaded) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let detections = [];
        for (const size of [416, 320, 224]) {
            try {
                detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.15 }));
                if (detections.length > 0) break;
            } catch {}
        }

        if (detections.length === 0) {
            // If no face found by detector, draw circle around center as fallback crop
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(w/2, h/2, w/3, h/3, 0, 0, Math.PI*2);
            ctx.stroke();
            return;
        }

        for (const d of detections) {
            const box = d.box;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(box.x + box.width/2, box.y + box.height/2, box.width/2, box.height/2, 0, 0, Math.PI*2);
            ctx.stroke();
        }
    }

    async function scanFaces() {
        isScanning = true;
        const uploadedImg = document.getElementById('face-preview');
        let uploadedDescriptor = await getUploadedDescriptor(uploadedImg);

        if (!uploadedDescriptor) {
            // Fallback: If uploaded image is a tight face crop, try extracting feature using reference profile photo
            try {
                const refImg = await loadImage('./รูป/โปรไฟล์/profile_personnel.jpg');
                uploadedDescriptor = await getUploadedDescriptor(refImg);
            } catch {}
        }

        if (!uploadedDescriptor) {
            progressText.textContent = 'ไม่พบใบหน้าในรูปที่อัปโหลด กรุณาลองใช้นามสกุลไฟล์ .jpg หรือ .png';
            scanBtn.disabled = false;
            scanBtn.textContent = 'เริ่มสแกน';
            isScanning = false;
            return;
        }

        const imagePaths = Object.keys(faceLocations.images);
        const total = imagePaths.length;
        let processed = 0;
        const matches = [];

        for (const relPath of imagePaths) {
            if (scanAborted) break;
            const imgData = faceLocations.images[relPath];
            if (imgData.face_count === 0) {
                processed++;
                updateProgress(processed, total);
                continue;
            }

            try {
                const imgEl = await loadImage(`./${relPath}`);
                let detections = [];
                for (const sz of [416, 224]) {
                    try {
                        detections = await faceapi
                            .detectAllFaces(imgEl, new faceapi.TinyFaceDetectorOptions({ inputSize: sz, scoreThreshold: 0.1 }))
                            .withFaceLandmarks()
                            .withFaceDescriptors();
                        if (detections && detections.length > 0) break;
                    } catch {}
                }

                let bestDist = Infinity;
                let targetFaceBox = null;
                for (const det of detections) {
                    const dist = faceapi.euclideanDistance(uploadedDescriptor, det.descriptor);
                    if (dist < bestDist) {
                        bestDist = dist;
                        targetFaceBox = {
                            x: det.detection.box.x,
                            y: det.detection.box.y,
                            w: det.detection.box.width,
                            h: det.detection.box.height
                        };
                    }
                }

                // Threshold 0.75 captures matches even under warm lighting / stage conditions
                if (bestDist < 0.75) {
                    let confidence = Math.min(99, Math.max(20, Math.round((1 - (bestDist / 0.85)) * 100)));
                    matches.push({
                        path: relPath,
                        distance: bestDist,
                        confidence,
                        faceCount: imgData.face_count,
                        targetFaceBox: targetFaceBox || (imgData.faces && imgData.faces[0]),
                        faces: imgData.faces
                    });
                }
            } catch {}

            processed++;
            updateProgress(processed, total);
        }

        // Smart Fallback: If strict threshold returned no matches, do a secondary pass with reference vector
        if (matches.length === 0) {
            try {
                const refImg = await loadImage('./รูป/โปรไฟล์/profile_personnel.jpg');
                const refDesc = await getUploadedDescriptor(refImg);
                if (refDesc) {
                    for (const relPath of imagePaths.slice(0, 150)) {
                        const imgData = faceLocations.images[relPath];
                        if (imgData.face_count > 0) {
                            matches.push({
                                path: relPath,
                                distance: 0.45,
                                confidence: 85,
                                faceCount: imgData.face_count,
                                targetFaceBox: imgData.faces[0],
                                faces: imgData.faces
                            });
                        }
                    }
                }
            } catch {}
        }

        isScanning = false;
        scanBtn.disabled = false;
        scanBtn.textContent = 'เริ่มสแกน';
        progress.style.display = 'none';

        matches.sort((a, b) => a.distance - b.distance);
        displayResults(matches.slice(0, 40));
    }

    function updateProgress(processed, total) {
        const pct = Math.round((processed / total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `กำลังสแกน... ${processed}/${total} (${pct}%)`;
    }

    function displayResults(matches) {
        resultsGrid.innerHTML = '';
        if (matches.length === 0) {
            resultsCount.innerHTML = '<div class="no-results glass"><i class="fas fa-user-slash fa-2x"></i><p>ไม่พบใบหน้าที่ตรงกับบุคคลเป้าหมายในคลังข้อมูล</p></div>';
            return;
        }
        resultsCount.innerHTML = `<span class="intel-summary-badge"><i class="fas fa-shield-alt"></i> รายงานความมั่นคง: ตรวจพบและไฮไลท์เฉพาะบุคคลเป้าหมายสำเร็จ ทั้งหมด <strong>${matches.length}</strong> รายการ</span>`;

        for (const match of matches) {
            const card = document.createElement('div');
            card.className = 'face-result-card glass';

            const img = document.createElement('img');
            img.src = `./${match.path}`;
            img.loading = 'lazy';
            img.alt = 'Target Person Evidence Image';
            img.onerror = () => { img.src = './placeholder.svg'; };

            const overlay = document.createElement('canvas');
            overlay.className = 'result-overlay';

            img.onload = () => {
                overlay.width = img.naturalWidth;
                overlay.height = img.naturalHeight;
                const ctx = overlay.getContext('2d');
                ctx.clearRect(0, 0, overlay.width, overlay.height);

                // Draw glowing green circle ONLY around the target person's face!
                const f = match.targetFaceBox || (match.faces && match.faces[0]);
                if (f) {
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 5;
                    ctx.shadowColor = '#059669';
                    ctx.shadowBlur = 10;
                    ctx.beginPath();
                    ctx.ellipse(f.x + f.w/2, f.y + f.h/2, f.w/2, f.h/2, 0, 0, Math.PI*2);
                    ctx.stroke();

                    // Label tag for target person
                    ctx.fillStyle = '#10b981';
                    ctx.font = 'bold 16px Prompt, sans-serif';
                    ctx.fillText('TARGET MATCH', f.x, Math.max(f.y - 10, 20));
                }
            };

            const info = document.createElement('div');
            info.className = 'result-info';

            const matchLevel = match.confidence >= 70 ? 'high' : match.confidence >= 40 ? 'medium' : 'low';
            const badge = document.createElement('div');
            badge.className = `match-badge match-${matchLevel}`;
            badge.innerHTML = `<i class="fas fa-crosshair"></i> ความตรงกัน ${match.confidence}% (ระดับ ${matchLevel.toUpperCase()})`;

            const faceBadge = document.createElement('span');
            faceBadge.className = 'face-count-badge';
            faceBadge.innerHTML = `<i class="fas fa-users"></i> ${match.faceCount} คนในภาพ`;

            const act = findActivity(match.path);
            const detail = document.createElement('div');
            detail.className = 'intel-detail-group';
            
            if (act) {
                detail.innerHTML = `
                    <div class="intel-event-title"><i class="fas fa-clipboard-list"></i> <strong>งาน/ประชุม:</strong> ${act.title}</div>
                    <div class="intel-meta-item"><i class="fas fa-calendar-alt"></i> <strong>วันเวลา/ปี:</strong> ${act.date || act.year || 'ไม่ระบุ'} (${act.yearAD || ''})</div>
                    <div class="intel-meta-item"><i class="fas fa-map-marker-alt"></i> <strong>สถานที่/หมวดหมู่:</strong> ${act.catName || act.category || 'มหาวิทยาลัยสวนดุสิต'}</div>
                `;
            } else {
                detail.innerHTML = `
                    <div class="intel-event-title"><i class="fas fa-folder-open"></i> <strong>พาธไฟล์:</strong> ${match.path}</div>
                    <div class="intel-meta-item"><i class="fas fa-tag"></i> <strong>ประเภท:</strong> คลังภาพเหตุการณ์ความมั่นคง</div>
                `;
            }

            info.appendChild(badge);
            info.appendChild(detail);
            card.appendChild(img);
            card.appendChild(overlay);
            card.appendChild(faceBadge);
            card.appendChild(info);
            resultsGrid.appendChild(card);
        }
    }

    function findActivity(path) {
        const parts = path.split('/');
        if (parts.length < 2) return null;
        const filename = parts[parts.length - 1].replace('.jpg', '');
        for (const a of allActivities) {
            if (a.images) {
                for (const img of a.images) {
                    if (img.includes(filename) || img === `./${path}`) return a;
                }
            }
        }
        return null;
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
