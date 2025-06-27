const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { parseStringPromise, Builder } = require("xml2js");

const app = express();
const PORT = 3000;

// Tạo thư mục uploads nếu chưa có
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Cấu hình multer
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Truy cập file tĩnh từ public
app.use(express.static(path.join(__dirname, "public")));

app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ success: false, error: "Không có file được upload" });

        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        const sceneName = req.body.sceneName || "scene_" + Date.now();

        const inputImagePath = path.join(uploadDir, file.filename + ext);
        fs.renameSync(file.path, inputImagePath); // thêm đuôi .jpg

        // Gọi lệnh krpanotools.exe
        const krpanoExe = path.join(__dirname, "krpanotools.exe");
        const configPath = path.join(__dirname, "templates", "vtour-multires.config");
        const quote = s => `"${s}"`;
        const command = `${quote(krpanoExe)} makepano ${quote(configPath)} ${quote(inputImagePath)}`;
        console.log("👉 RUN:", command);

        exec(command, async (err, stdout, stderr) => {
            if (err) {
                console.error("❌ Lỗi khi chạy krpanotools:", err);
                return res.status(500).json({ success: false, error: "Lỗi xử lý ảnh với krpano" });
            }

            const vtourPath = path.join(__dirname, "vtour");
            const panoDir = path.join(vtourPath, "panos");
            const outputDir = path.join(__dirname, "public", "panos", sceneName);

            if (!fs.existsSync(panoDir)) {
                return res.status(500).json({ success: false, error: "Không tìm thấy thư mục tile (panos)" });
            }

            const tileFolders = fs.readdirSync(panoDir).filter(name =>
                fs.statSync(path.join(panoDir, name)).isDirectory()
            );

            if (tileFolders.length === 0) {
                return res.status(500).json({ success: false, error: "Không có dữ liệu tile được tạo ra" });
            }

            const tileFolder = tileFolders[0];

            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
            fs.renameSync(path.join(panoDir, tileFolder), path.join(outputDir, tileFolder));

            // Xóa thư mục panos tạm
            fs.rmSync(panoDir, { recursive: true, force: true });

            // Thêm vào tour.xml
            const xmlPath = path.join(__dirname, "public", "tour.xml");
            const xmlRaw = fs.readFileSync(xmlPath, "utf-8");
            const xmlJson = await parseStringPromise(xmlRaw);

            const sceneTag = {
                $: {
                    name: sceneName,
                    title: sceneName,
                    thumburl: `panos/${sceneName}/${tileFolder}/thumb.jpg`
                },
                view: [{ $: { fov: "100" } }],
                image: [{
                    $: { type: "CUBE" },
                    cube: [{ $: { url: `panos/${sceneName}/${tileFolder}/pano_%s.jpg` } }]
                }]
            };

            xmlJson.krpano.scene = xmlJson.krpano.scene || [];
            xmlJson.krpano.scene.push(sceneTag);

            const builder = new Builder();
            const updatedXml = builder.buildObject(xmlJson);
            fs.writeFileSync(xmlPath, updatedXml, "utf-8");

            console.log("✅ Scene đã thêm:", sceneName);
            res.json({ success: true, message: "✔️ Scene added", scene: sceneName });
        });

    } catch (err) {
        console.error("❌ Server Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server is running at http://localhost:${PORT}`);
});
