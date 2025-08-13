const axios = require('axios');
const fs = require('fs');

async function fetchAndSaveStockMaster() {
  try {
    const url = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (response.data) {
      fs.writeFileSync('OpenAPIScripMaster.json', JSON.stringify(response.data, null, 2));
      console.log('✅ JSON data saved to OpenAPIScripMaster.json');
    } else {
      console.error('❌ No data received from API');
    }
  } catch (error) {
    console.error('❌ Error fetching or saving data:', error.message);
  }
}

fetchAndSaveStockMaster();
