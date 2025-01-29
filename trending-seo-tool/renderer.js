const axios = require('axios');
const openaiApiKey = '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';  // Replace with your OpenAI API Key

const generateHashtagsButton = document.getElementById('generateHashtagsButton');
const inputText = document.getElementById('inputText');
const hashtagsOutput = document.getElementById('hashtags');
const articleOutput = document.getElementById('article');

generateHashtagsButton.addEventListener('click', async () => {
  const topic = inputText.value;
  if (topic.trim() === '') {
    alert('Please enter a topic!');
    return;
  }

  try {
    // Generate trending hashtags using OpenAI API
    const hashtagsResponse = await axios.post('https://api.openai.com/v1/completions', {
      model: 'text-davinci-003',
      prompt: `Generate trending hashtags for this topic: ${topic}`,
      max_tokens: 50,
    }, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const hashtags = hashtagsResponse.data.choices[0].text.trim();
    hashtagsOutput.innerText = hashtags;

    // Generate SEO article using OpenAI API
    const articleResponse = await axios.post('https://api.openai.com/v1/completions', {
      model: 'text-davinci-003',
      prompt: `Write an SEO-optimized article about the following topic: ${topic}`,
      max_tokens: 300,
    }, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const article = articleResponse.data.choices[0].text.trim();
    articleOutput.innerText = article;
  } catch (error) {
    console.error('Error generating content:', error);
  }
});
