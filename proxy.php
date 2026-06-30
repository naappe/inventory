<?php
// ============================================================
// proxy.php - PRODUCTION-GRADE API GATEWAY
// ============================================================

// ============================================================
// 1. CORS CONFIGURATION
// ============================================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Ewity-Platform, x-client, x-pos-client-id');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Always return JSON
header('Content-Type: application/json');

// ============================================================
// 2. CONFIGURATION
// ============================================================
define('EWITY_BASE_URL', 'https://app.ewitypos.com/api');
define('DEFAULT_ENDPOINT', 'ecom-v1/products');
define('TIMEOUT', 30);
define('MAX_RETRIES', 2);

// Debug mode (only enabled with ?debug=1)
$debug = isset($_GET['debug']) && $_GET['debug'] === '1';

// ============================================================
// 3. HELPER FUNCTIONS
// ============================================================

// Get Authorization header (Hostinger-safe)
function getAuthHeader() {
    // Check $_SERVER first (most reliable on Hostinger)
    if (isset($_SERVER['HTTP_AUTHORIZATION']) && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    // Fallback to getallheaders()
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization']) && !empty($headers['Authorization'])) {
            return $headers['Authorization'];
        }
    }
    
    return null;
}

// Safe JSON response
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

// Error response
function errorResponse($code, $message, $details = null, $status = 400) {
    $response = [
        'success' => false,
        'error' => $code,
        'message' => $message
    ];
    
    if ($details && $debug) {
        $response['details'] = $details;
    }
    
    jsonResponse($response, $status);
}

// Success response
function successResponse($data) {
    jsonResponse([
        'success' => true,
        'data' => $data
    ], 200);
}

// ============================================================
// 4. INPUT VALIDATION
// ============================================================

// Get and sanitize path
$path = isset($_GET['path']) ? trim($_GET['path'], '/') : DEFAULT_ENDPOINT;

// Whitelist allowed endpoints (security)
$allowedEndpoints = [
    'ecom-v1/products',
    'ecom-v1/locations',
    'ecom-v1/users/me',
    'v1/products',
    'v1/locations',
    'ecom-v1/locations/1/products'
];

if (!in_array($path, $allowedEndpoints) && $debug) {
    errorResponse('INVALID_ENDPOINT', 'Endpoint not in whitelist', ['path' => $path], 403);
}

// Build URL
$url = EWITY_BASE_URL . '/' . $path;

// ============================================================
// 5. GET AUTHENTICATION
// ============================================================

$auth = getAuthHeader();

if (empty($auth)) {
    errorResponse('MISSING_AUTH', 'Authorization header is required', null, 401);
}

// ============================================================
// 6. EXECUTE REQUEST (WITH RETRY)
// ============================================================

$attempt = 0;
$response = null;
$httpCode = null;
$error = null;
$contentType = null;

do {
    $attempt++;
    
    $ch = curl_init($url);
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, TIMEOUT);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    // Build headers (ONLY if auth exists)
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
    $info = curl_getinfo($ch);
    
    curl_close($ch);
    
    // If cURL failed and we have retries left
    if ($response === false && $attempt < MAX_RETRIES) {
        usleep(500000); // Wait 0.5 seconds
        continue;
    }
    
    break;
    
} while ($attempt < MAX_RETRIES);

// ============================================================
// 7. ERROR HANDLING
// ============================================================

// 7.1: cURL failed
if ($response === false) {
    errorResponse('CURL_ERROR', 'Failed to connect to Ewity API', [
        'attempt' => $attempt,
        'error' => $error,
        'url' => $url
    ], 500);
}

// 7.2: Check Content-Type (MOST RELIABLE method)
if (strpos($contentType, 'application/json') === false) {
    $htmlPreview = substr($response, 0, 500);
    
    // Try to extract a meaningful error from HTML
    $message = 'Non-JSON response received';
    if (strpos($response, '401') !== false || strpos($response, 'Unauthorized') !== false) {
        $message = '401 Unauthorized - Check your API token and permissions';
    } elseif (strpos($response, '403') !== false || strpos($response, 'Forbidden') !== false) {
        $message = '403 Forbidden - Insufficient permissions';
    } elseif (strpos($response, '404') !== false || strpos($response, 'Not Found') !== false) {
        $message = '404 Not Found - Invalid endpoint';
    } elseif (strpos($response, '500') !== false) {
        $message = '500 Internal Server Error - Try again later';
    }
    
    errorResponse('INVALID_RESPONSE', $message, [
        'content_type' => $contentType,
        'html_preview' => $htmlPreview,
        'status' => $httpCode
    ], $httpCode ?: 500);
}

// 7.3: Validate JSON
$json = json_decode($response, true);
if ($json === null) {
    errorResponse('INVALID_JSON', 'Response is not valid JSON', [
        'preview' => substr($response, 0, 300)
    ], 500);
}

// 7.4: Detect API error response
if (isset($json['error']) || isset($json['errorCode']) || isset($json['code'])) {
    $errorCode = $json['error'] ?? $json['errorCode'] ?? $json['code'] ?? 'API_ERROR';
    $errorMessage = $json['message'] ?? $json['errorMessage'] ?? 'Unknown API error';
    
    errorResponse($errorCode, $errorMessage, $json, $httpCode ?: 400);
}

// ============================================================
// 8. DEBUG MODE (only if explicitly enabled)
// ============================================================

if ($debug) {
    $debugInfo = [
        'url' => $url,
        'path' => $path,
        'status' => $httpCode,
        'content_type' => $contentType,
        'attempts' => $attempt,
        'auth_present' => !empty($auth),
        'response_size' => strlen($response)
    ];
    
    // Only add if response is an array
    if (is_array($json)) {
        $json['_debug'] = $debugInfo;
        successResponse($json);
    } else {
        successResponse([
            'data' => $json,
            '_debug' => $debugInfo
        ]);
    }
}

// ============================================================
// 9. SUCCESS
// ============================================================

// Return the original response
http_response_code($httpCode);
echo $response;
?>
