require('dotenv').config({ override: true });

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error('Set a valid GEMINI_API_KEY in backend/.env before running this test.');
    process.exit(1);
  }

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Explain how AI works in a few words" }] }]
        })
      }
    );
    const data = await response.json();
    if (response.ok) {
      console.log("SUCCESS:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log("ERROR:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("NETWORK ERROR:", error.message);
  }
}

testGemini();
