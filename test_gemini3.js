const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    const result = await model.generateContent("Hello, testing gemini-2.5-flash");
    console.log(result.response.text());
  } catch (error) {
    console.error("ERROR:", error.message);
  }
}
run();
