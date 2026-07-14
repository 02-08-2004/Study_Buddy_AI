require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  console.log('🧪 Testing Gemini Connection...');
  console.log('Key:', process.env.GEMINI_API_KEY.substring(0, 10) + '...');
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Test multiple model names to see which one works
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    
    for (const modelName of models) {
      console.log(`\nTrying model: ${modelName}...`);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say hello!');
        const response = await result.response;
        console.log(`✅ ${modelName} worked! Response:`, response.text());
        return; // Success!
      } catch (err) {
        console.log(`❌ ${modelName} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('💥 Fatal Error:', err.message);
  }
}

testGemini();
