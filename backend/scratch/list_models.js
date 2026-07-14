require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

async function listModels() {
  console.log('🔍 Fetching allowed models for your key...');
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data.models) {
      console.log('✅ Found models:');
      response.data.models.forEach(m => {
        console.log(` - ${m.name} (${m.displayName})`);
      });
    } else {
      console.log('❓ No models found in the response.');
    }
  } catch (err) {
    console.error('❌ Error listing models:', err.response?.data?.error?.message || err.message);
  }
}

listModels();
