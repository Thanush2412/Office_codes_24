const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const configuration = new Configuration({
  apiKey: "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", // Replace with your OpenAI API key
});
const openai = new OpenAIApi(configuration);

app.post("/generate-hashtags", async (req, res) => {
  const { keywords, audience, theme } = req.body;

  const prompt = `
    Generate 10 trending and catchy hashtags for the ed-tech space.
    Keywords: ${keywords}
    Audience: ${audience}
    Theme: ${theme}
    Ensure hashtags are short, relevant, and engaging.
  `;

  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 100,
    });

    const hashtags = response.data.choices[0].text.trim().split("\n");
    res.json({ hashtags });
  } catch (error) {
    console.error("Error generating hashtags:", error);
    res.status(500).send("Error generating hashtags.");
  }
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
