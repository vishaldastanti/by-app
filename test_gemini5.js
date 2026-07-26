const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  try {
    const result = await model.generateContent("Hello, testing gemini-2.0-flash-lite");
    console.log(result.response.text());
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
