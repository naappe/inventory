const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for your local frontend
app.use(cors());

app.get('/api/products', async (req, res) => {
    try {
        const targetUrl = 'https://app.ewitypos.com/api/v1/products/locations/all';
        
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer uat_0i1SgXb9Ps4NrjdmTAc1fsWmfzpe',
                'X-Ewity-Platform': 'web',
                'x-client': 'Web',
                'x-pos-client-id': 'web-client',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Ewity API responded with status ${response.status}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Security Proxy server running at http://localhost:${PORT}`);
});