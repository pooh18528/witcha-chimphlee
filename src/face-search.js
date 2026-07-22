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

    async function drawFaceDetect(img, canvas) {
        if (!modelsLoaded) return;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }));
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const d of detections) {
            const box = d.box;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(box.x + box.width/2, box.y + box.height/2, box.width/2, box.height/2, 0, 0, Math.PI*2);
            ctx.stroke();
        }
    }

    async function scanFaces() {
        isScanning = true;
        const uploadedImg = document.getElementById('face-preview');
        let uploadedDescriptor = null;

        try {
            const fullDesc = await faceapi
                .detectSingleFace(uploadedImg, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (fullDesc) uploadedDescriptor = fullDesc.descriptor;
        } catch {}

        if (!uploadedDescriptor) {
            progressText.textContent = 'ไม่พบใบหน้าในรูปที่อัปโหลด';
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
                const detections = await faceapi
                    .detectAllFaces(imgEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                let bestDist = Infinity;
                for (const det of detections) {
                    const dist = faceapi.euclideanDistance(uploadedDescriptor, det.descriptor);
                    if (dist < bestDist) bestDist = dist;
                }

                if (bestDist < 0.6) {
                    let confidence = Math.round((1 - bestDist) * 100);
                    matches.push({
                        path: relPath,
                        distance: bestDist,
                        confidence,
                        faceCount: imgData.face_count,
                        faces: imgData.faces,
                    });
                }
            } catch {}

            processed++;
            updateProgress(processed, total);
        }

        isScanning = false;
        scanBtn.disabled = false;
        scanBtn.textContent = 'เริ่มสแกน';
        progress.style.display = 'none';

        matches.sort((a, b) => a.distance - b.distance);
        displayResults(matches);
    }

    function updateProgress(processed, total) {
        const pct = Math.round((processed / total) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `กำลังสแกน... ${processed}/${total} (${pct}%)`;
    }

    function displayResults(matches) {
        resultsGrid.innerHTML = '';
        if (matches.length === 0) {
            resultsCount.textContent = 'ไม่พบใบหน้าที่ตรงกัน';
            return;
        }
        resultsCount.textContent = `พบ ${matches.length} รายการ`;

        for (const match of matches) {
            const card = document.createElement('div');
            card.className = 'face-result-card';

            const img = document.createElement('img');
            img.src = `./${match.path}`;
            img.loading = 'lazy';

            const overlay = document.createElement('canvas');
            overlay.className = 'result-overlay';

            img.onload = () => {
                overlay.width = img.naturalWidth;
                overlay.height = img.naturalHeight;
                const ctx = overlay.getContext('2d');
                ctx.clearRect(0, 0, overlay.width, overlay.height);
                for (const f of match.faces) {
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.ellipse(f.x + f.w/2, f.y + f.h/2, f.w/2, f.h/2, 0, 0, Math.PI*2);
                    ctx.stroke();
                }
            };

            const info = document.createElement('div');
            info.className = 'result-info';

            const badge = document.createElement('span');
            badge.className = `match-badge match-${match.confidence >= 70 ? 'high' : match.confidence >= 40 ? 'medium' : 'low'}`;
            badge.textContent = `${match.confidence}% ตรง`;

            const faceBadge = document.createElement('span');
            faceBadge.className = 'face-count-badge';
            faceBadge.textContent = `${match.faceCount} คน`;

            const act = findActivity(match.path);
            const detail = document.createElement('div');
            detail.style.marginTop = '4px';
            detail.style.fontSize = '0.8rem';
            detail.style.color = 'var(--text-muted)';
            if (act) {
                detail.innerHTML = `
                    <div>${act.title || ''}</div>
                    <div>${act.year || ''} ${act.category || ''}</div>
                `;
            } else {
                detail.textContent = match.path.split('/').slice(0, 2).join(' > ');
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
