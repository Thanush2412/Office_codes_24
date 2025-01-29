import React, { useState } from "react";
import { OpenAI } from "openai";

const App = () => {
  const [keywords, setKeywords] = useState("");
  const [audience, setAudience] = useState("");
  const [theme, setTheme] = useState("");
  const [hashtags, setHashtags] = useState([]);
  const [loading, setLoading] = useState(false);

  const generateHashtags = async () => {
    setLoading(true);

    // OpenAI API Configuration
    const openai = new OpenAI({
      apiKey: "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",
      dangerouslyAllowBrowser: true, // Replace with your actual API key
    });

    // Prompt construction
    const prompt = `
          Generate 10 trending and catchy hashtags for the ed-tech space.
          Keywords: ${keywords}
          Audience: ${audience}
          Theme: ${theme}
          Ensure hashtags are short, relevant, and engaging.
        `;

    try {
      const response = await openai.completions.create({
        model: "text-davinci-003",
        prompt: prompt,
        max_tokens: 100,
      });

      // Process the response
      const generatedHashtags = response.choices[0].text.trim().split("\n");
      setHashtags(generatedHashtags);
    } catch (error) {
      console.error("Error generating hashtags:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h1>Ed-Tech Hashtag Generator</h1>
      <div>
        <label>Keywords:</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g., online learning, STEM"
        />
      </div>
      <div>
        <label>Audience:</label>
        <input
          type="text"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g., students, educators"
        />
      </div>
      <div>
        <label>Theme:</label>
        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="e.g., technology, higher education"
        />
      </div>
      <button onClick={generateHashtags} disabled={loading}>
        {loading ? "Generating..." : "Generate Hashtags"}
      </button>
      <div>
        <h2>Generated Hashtags</h2>
        <ul>
          {hashtags.map((hashtag, index) => (
            <li key={index}>{hashtag}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App;
