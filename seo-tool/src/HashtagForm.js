import React, { useState } from "react";

const HashtagForm = ({ onSubmit }) => {
  const [keywords, setKeywords] = useState("");
  const [audience, setAudience] = useState("");
  const [theme, setTheme] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const inputData = { keywords, audience, theme };
    onSubmit(inputData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Keywords:</label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="e.g., online learning, STEM"
          required
        />
      </div>
      <div>
        <label>Audience:</label>
        <input
          type="text"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g., students, educators"
          required
        />
      </div>
      <div>
        <label>Theme:</label>
        <input
          type="text"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="e.g., technology, higher education"
          required
        />
      </div>
      <button type="submit">Generate Hashtags</button>
    </form>
  );
};

export default HashtagForm;
