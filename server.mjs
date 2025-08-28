import dotenv from "dotenv";
dotenv.config();
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // save in uploads folder
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // keep original file name
  }
});

const upload = multer({ storage: storage });
// =============== ROUTES =================
// Health Check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'biz-rag-backend', time: new Date().toISOString() });
});

// Upload document route
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ message: "File uploaded successfully", file: req.file.filename });
});

console.log("API Key loaded:", process.env.OPENAI_API_KEY ? "✅ yes" : "❌ no");


// Ask question (now using OpenAI v5 client)
app.post("/ask", async (req, res) => {
  try {
    const { question, document } = req.body;

    if (!question || !document) {
      return res.status(400).json({ error: "Question and document are required" });
    }

    // Read uploaded file
    const filePath = path.join("uploads", document[0]);
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // OpenAI setup
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Ask GPT with document context
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",  // cheaper & faster; or use gpt-4-turbo if enabled
      messages: [
        { role: "system", content: "You are a helpful assistant that answers questions based only on the given document." },
        { role: "user", content: `Document:\n${fileContent}\n\nQuestion: ${question}` }
      ],
    });

    const answer = response.choices[0].message.content;

    res.json({ question, answer, document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error processing request" });
  }
});

// =============== SERVER START =================
const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
