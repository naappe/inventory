<?php
// proxy.php - FINAL WORKING VERSION

// Allow CORS
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Get the path
$path = isset($_GET['path']) ? $_GET['path'] : 'ecom-v1/products';
$url = 'https://app.ewitypos.com/api/' . $path;

// Get headers
$headers = getallheaders();
$auth = isset($headers['Authorization']) ? $headers['Authorization'] : '';

// Setup cURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ' . $auth,
    'X-Ewity-Platform: web',
    'Content-Type: application/json'
]);

// Execute
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Return
http_response_code($httpCode);
echo $response;
?>
