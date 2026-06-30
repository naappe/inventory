<?php
// proxy.php - Ewity API Proxy

// Enable CORS for your frontend
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Ewity-Platform, x-client, x-pos-client-id');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get the requested path
$path = isset($_GET['path']) ? $_GET['path'] : '';
$baseUrl = 'https://app.ewitypos.com/api';

// Build the full URL
$url = $baseUrl . '/' . ltrim($path, '/');

// Get the Authorization header
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

// Forward the request to Ewity API
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// Set headers
$curlHeaders = [
    'Authorization: ' . $authHeader,
    'Content-Type: application/json',
    'Accept: application/json'
];

// Add Ewity specific headers if present
if (isset($headers['X-Ewity-Platform'])) {
    $curlHeaders[] = 'X-Ewity-Platform: ' . $headers['X-Ewity-Platform'];
}
if (isset($headers['x-client'])) {
    $curlHeaders[] = 'x-client: ' . $headers['x-client'];
}
if (isset($headers['x-pos-client-id'])) {
    $curlHeaders[] = 'x-pos-client-id: ' . $headers['x-pos-client-id'];
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

// Execute the request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Return the response
http_response_code($httpCode);
echo $response;
?>
