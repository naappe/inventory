<?php
// ============================================================
// proxy.php - PRODUCTION GRADE WITH FULL LOGGING
// ============================================================

// ============================================================
// 1. CORS HEADERS
// ============================================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Ewity-Platform, x-client, x-pos-client-id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

// ============================================================
// 2. CONFIGURATION
// ============================================================
define('EWITY_BASE', 'https://app.ewitypos.com/api');
define('TIMEOUT', 30);
define('LOG_FILE', __DIR__ . '/proxy_log.txt');

// ============================================================
// 3. LOGGING FUNCTION
// ============================================================
function logMessage($message, $data = null) {
    $log = date('Y-m-d H:i:s') . ' - ' . $message;
    if ($data !== null) {
        $log .= ' - ' . json_encode($data);
    }
    $log .= PHP_EOL;
    file_put_contents(LOG_FILE, $log, FILE_APPEND);
}

// ============================================================
// 4. SAFE AUTH CAPTURE (HOSTINGER COMPATIBLE)
// ============================================================
function getAuthHeader() {
    // Method 1: Direct $_SERVER
    if (isset($_SERVER['HTTP_AUTHORIZATION']) && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
        logMessage('Auth found in HTTP_AUTHORIZATION');
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    // Method 2: Redirected version (common on Hostinger)
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        logMessage('Auth found in REDIRECT_HTTP_AUTHORIZATION');
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    // Method 3: getallheaders()
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                logMessage('Auth found in getallheaders()');
                return $value;
            }
        }
    }
    
    logMessage('No Authorization header found');
    return null;
}

// ============================================================
// 5. MAIN PROXY LOGIC
// ============================================================

// Get the path
$path = isset($_GET['path']) ? trim($_GET['path'], '/') : 'ecom-v1/products';
$url = EWITY_BASE . '/' . $path;

logMessage('Request started', ['path' => $path, 'url' => $url]);

// Get auth
$auth = getAuthHeader();

// Log auth status (without exposing full token)
$authStatus = $auth ? 'YES (length: ' . strlen($auth) . ')' : 'NO';
logMessage('Auth present: ' . $authStatus);

// Initialize cURL
$ch = curl_init($url);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, TIMEOUT);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HEADER, true); // Capture headers too

// Build headers
$headers = [
    'Accept: application/json',
    'Content-Type: application/json',
    'X-Ewity-Platform: web',
    'User-Agent: Ewity-Proxy/1.0'
];

// Only add Authorization if it exists
if ($auth) {
    $headers[] = 'Authorization: ' . $auth;
    logMessage('Authorization header added');
} else {
    logMessage('WARNING: No Authorization header to send');
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Execute
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$error = curl_error($ch);
$info = curl_getinfo($ch);

curl_close($ch);

// ============================================================
// 6. ERROR HANDLING WITH FULL LOGGING
// ============================================================

// Log the result
logMessage('Response', [
    'status' => $httpCode,
    'content_type' => $contentType,
    'error' => $error,
    'response_size' => strlen($response)
]);

// Case 1: cURL failed
if ($response === false || $error) {
    logMessage('CURL ERROR: ' . $error);
    http_response_code(500);
    echo json_encode([
        'error' => 'CURL_ERROR',
        'message' => $error ?: 'Unknown cURL error',
        'url' => $url,
        'auth_sent' => $auth ? true : false
    ]);
    exit;
}

// Case 2: Non-JSON response (HTML error)
if (strpos($contentType, 'application/json') === false) {
    // Check if it's HTML
    $isHtml = strpos($response, '<!DOCTYPE') !== false || strpos($response, '<html') !== false;
    $preview = $isHtml ? 'HTML response' : substr($response, 0, 300);
    
    logMessage('NON-JSON RESPONSE', ['content_type' => $contentType, 'is_html' => $isHtml]);
    
    // Extract meaningful error from HTML if possible
    $errorMessage = 'Non-JSON response received';
    if (strpos($response, '401') !== false || strpos($response, 'Unauthorized') !== false) {
        $errorMessage = '401 Unauthorized - Check your API token and permissions';
    } elseif (strpos($response, '403') !== false || strpos($response, 'Forbidden') !== false) {
        $errorMessage = '403 Forbidden - Insufficient permissions';
    } elseif (strpos($response, '404') !== false || strpos($response, 'Not Found') !== false) {
        $errorMessage = '404 Not Found - Check endpoint path: ' . $path;
    } elseif (strpos($response, '500') !== false) {
        $errorMessage = '500 Internal Server Error - Try again later';
    }
    
    http_response_code($httpCode ?: 500);
    echo json_encode([
        'error' => 'HTML_RESPONSE',
        'message' => $errorMessage,
        'path' => $path,
        'url' => $url,
        'auth_sent' => $auth ? true : false,
        'status' => $httpCode,
        'content_type' => $contentType,
        'html_preview' => substr($response, 0, 500)
    ]);
    exit;
}

// Case 3: Validate JSON
$json = json_decode($response, true);
if ($json === null) {
    logMessage('INVALID JSON: ' . json_last_error_msg());
    http_response_code(500);
    echo json_encode([
        'error' => 'INVALID_JSON',
        'message' => 'Response is not valid JSON',
        'preview' => substr($response, 0, 300)
    ]);
    exit;
}

// Case 4: API error response
if (isset($json['error']) || isset($json['errorCode']) || isset($json['code'])) {
    $errorCode = $json['error'] ?? $json['errorCode'] ?? $json['code'] ?? 'API_ERROR';
    $errorMessage = $json['message'] ?? $json['errorMessage'] ?? 'Unknown API error';
    
    logMessage('API ERROR: ' . $errorCode . ' - ' . $errorMessage);
    http_response_code($httpCode ?: 400);
    echo json_encode([
        'error' => $errorCode,
        'message' => $errorMessage,
        'details' => $json
    ]);
    exit;
}

// ============================================================
// 7. SUCCESS
// ============================================================
logMessage('SUCCESS: Returning JSON response');
http_response_code($httpCode);
echo $response;
?>
