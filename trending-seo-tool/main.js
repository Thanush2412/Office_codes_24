const axios = require('axios');

const apiKey = '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'; // Ensure this is securely stored
const model = 'gpt-3.5-turbo';
const prompt = 'Hello, OpenAI!';
const maxTokens = 50;

async function callOpenAI() {
  let retries = 5; // Number of retry attempts
  let delay = 1000; // Initial delay (1 second)

  while (retries > 0) {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: model,
        messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('API Response:', response.data);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.log('Rate limit hit, retrying...');
        retries -= 1;
        if (retries === 0) {
          console.log('Max retries reached. Please try again later.');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
        delay *= 2; // Exponentially increase delay
      } else {
        console.error('Error calling OpenAI API:', error);
        break;
      }
    }
  }
}

callOpenAI();
