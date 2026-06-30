<?php
// ============================================================
// proxy.php - Ewity API Proxy
// ============================================================

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Ewity-Platform, x-client, x-pos-client-id');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

// Get path
$path = isset($_GET['path']) ? trim($_GET['path'], '/') : 'ecom-v1/products';
$url = 'https://app.ewitypos.com/api/' . $path;

// Get Authorization header (Hostinger-safe)
$auth = '';
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
} elseif (function_exists('getallheaders')) {
    $headers = getallheaders();
    foreach ($headers as $key => $value) {
        if (strtolower($key) === 'authorization') {
            $auth = $value;
            break;
        }
    }
}

// Initialize cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

// Build headers
$headers = [
    'Accept: application/json',
    'Content-Type: application/json',
    'X-Ewity-Platform: web'
];

if (!empty($auth)) {
    $headers[] = 'Authorization: ' . $auth;
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Execute
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$error = curl_error($ch);
curl_close($ch);

// Check for cURL error
if ($response === false) {
    http_response_code(500);
    echo json_encode([
        'error' => 'CURL_ERROR',
        'message' => $error ?: 'Unknown cURL error'
    ]);
    exit;
}

// Check for HTML response
if (strpos($response, '<!DOCTYPE') !== false || strpos($response, '<html') !== false) {
    http_response_code($httpCode ?: 500);
    echo json_encode([
        'error' => 'HTML_RESPONSE',
        'message' => 'Server returned HTML instead of JSON',
        'status' => $httpCode,
        'content_type' => $contentType,
        'preview' => substr($response, 0, 300),
        'hint' => 'Check token, permissions, and endpoint path'
    ]);
    exit;
}

// Validate JSON
json_decode($response);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode([
        'error' => 'INVALID_JSON',
        'message' => 'Response is not valid JSON',
        'preview' => substr($response, 0, 300)
    ]);
    exit;
}

// Success
http_response_code($httpCode ?: 200);
echo $response;
?>
