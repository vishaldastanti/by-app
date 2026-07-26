require("dotenv").config();

async function run() {
  try {
    let pageToken = '';
    let models = [];
    do {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageToken=${pageToken}`);
      const data = await res.json();
      if (data.models) {
        models = models.concat(data.models.map(m => m.name));
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    console.log(models.join('\n'));
  } catch (error) {
    console.error("ERROR:", error);
  }
}
run();
