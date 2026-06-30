<?php
// proxy.php - Ewity API Proxy (FIXED)

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

// Get all headers
$headers = getallheaders();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

// Initialize cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

// Build headers for cURL
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
$error = curl_error($ch);
curl_close($ch);

// If there's an error, return it as JSON
if ($error) {
    http_response_code(500);
    echo json_encode(['error' => $error]);
    exit();
}

// Return the response with the correct status code
http_response_code($httpCode);

// Set content type to JSON
header('Content-Type: application/json');

echo $response;
?>
