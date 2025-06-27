const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { parseStringPromise, Builder } = require("xml2js");

const app = express();
const PORT = process.env.PORT || 3000;

// Cho phép CORS để frontend gọi được
app.use(cors());

// Cho phép xử lý form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Thư mục lưu ảnh
const uploadPath = path.join(__dirname, "public", "panos");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

// Cấu hình multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = "pano_" + Date.now() + ext;
        cb(null, name);
    },
});
const upload = multer({ storage });

// Truy cập file tĩnh
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "tour.html"));
});

// Upload ảnh và cập nhật XML
app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "Không có ảnh được upload!" });
        }

        const filename = req.file.filename;
        const sceneName = req.body.sceneName || "scene_" + Date.now();
        const title = req.body.title || "Ảnh tải lên";

        console.log("📥 Upload:", filename, sceneName);

        const xmlPath = path.join(__dirname, "public", "tour.xml");
        const xmlRaw = fs.readFileSync(xmlPath, "utf-8");
        const xmlJson = await parseStringPromise(xmlRaw);

        // Tạo scene mới
        const newScene = {
            $: { name: sceneName, title: title, thumburl: "panos/" + filename },
            view: [{ $: { fov: "100" } }],
            image: [{
                $: { type: "flat" },
                rect: [{ $: { url: "panos/" + filename } }]
            }]
        };

        xmlJson.krpano.scene = xmlJson.krpano.scene || [];
        xmlJson.krpano.scene.push(newScene);

        const builder = new Builder();
        const newXml = builder.buildObject(xmlJson);
        fs.writeFileSync(xmlPath, newXml, "utf-8");

        res.json({ success: true, message: "Scene added", filename });
    } catch (err) {
        console.error("❌ Upload Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log("✅ Server running at http://localhost:" + PORT);
});
