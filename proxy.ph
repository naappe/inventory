<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$ch = curl_init('https://app.ewitypos.com/api/v1/products/locations/all');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer uat_0i1SgXb9Ps4NrjdmTAc1fsWmfzpe',
    'X-Ewity-Platform: web',
    'x-client: Web',
    'x-pos-client-id: web-client'
]);
$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>