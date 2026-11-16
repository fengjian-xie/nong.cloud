<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function field(array $input, string $key, int $maxLength = 200): string
{
    $value = trim((string)($input[$key] ?? ''));
    $value = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $value) ?? '';
    return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength, 'UTF-8') : substr($value, 0, $maxLength);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => '仅支持 POST 提交']);
}

$allowedOrigins = ['https://xiangqiao.ltd', 'https://www.xiangqiao.ltd'];
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
    respond(403, ['ok' => false, 'message' => '来源校验失败']);
}

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength <= 0 || $contentLength > 24576) {
    respond(413, ['ok' => false, 'message' => '提交内容大小异常']);
}

$input = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['ok' => false, 'message' => '提交格式不正确']);
}
if (field($input, 'website', 100) !== '') {
    respond(200, ['ok' => true, 'emailSent' => false]);
}

$name = field($input, 'name', 40);
$phone = field($input, 'phone', 30);
$role = field($input, 'role', 40);
$areaMode = field($input, 'areaMode', 20);
$province = field($input, 'province', 40);
$city = field($input, 'city', 40);
$county = field($input, 'county', 60);
$town = field($input, 'town', 60);
$area = field($input, 'area', 140);
$need = field($input, 'need', 500);

if ($name === '' || $phone === '' || $role === '' || ($county === '' && $town === '')) {
    respond(422, ['ok' => false, 'message' => '请完整填写联系人、电话、身份和县域']);
}
if (!preg_match('/^[0-9+()\-\s]{6,30}$/', $phone)) {
    respond(422, ['ok' => false, 'message' => '联系电话格式不正确']);
}

$storageDir = getenv('XIANGQIAO_APPLICATION_DIR') ?: '/var/lib/xiangqiao/applications';
$rateDir = getenv('XIANGQIAO_RATE_LIMIT_DIR') ?: '/var/lib/xiangqiao/rate-limit';
if ((!is_dir($storageDir) && !mkdir($storageDir, 0750, true)) || (!is_dir($rateDir) && !mkdir($rateDir, 0750, true))) {
    respond(500, ['ok' => false, 'message' => '服务器暂时无法保存申请']);
}

$clientIp = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$ipHash = hash('sha256', $clientIp);
$rateFile = $rateDir . '/' . $ipHash;
if (is_file($rateFile) && time() - (int)filemtime($rateFile) < 15) {
    respond(429, ['ok' => false, 'message' => '提交过于频繁，请稍后再试']);
}
@touch($rateFile);

try {
    $reference = date('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(3)));
} catch (Throwable $error) {
    $reference = date('YmdHis') . '-' . strtoupper(substr(hash('sha256', uniqid('', true)), 0, 6));
}

$record = [
    'reference' => $reference,
    'submittedAt' => date(DATE_ATOM),
    'role' => $role,
    'name' => $name,
    'phone' => $phone,
    'areaMode' => $areaMode,
    'province' => $province,
    'city' => $city,
    'county' => $county,
    'town' => $town,
    'area' => $area,
    'need' => $need,
    'ipHash' => substr($ipHash, 0, 16),
    'userAgent' => field(['userAgent' => (string)($_SERVER['HTTP_USER_AGENT'] ?? '')], 'userAgent', 240),
];

$storageFile = $storageDir . '/applications-' . date('Y-m') . '.jsonl';
$encoded = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false || file_put_contents($storageFile, $encoded . PHP_EOL, FILE_APPEND | LOCK_EX) === false) {
    respond(500, ['ok' => false, 'message' => '申请保存失败，请稍后重试']);
}
@chmod($storageFile, 0640);

$recipient = getenv("JOIN_NOTIFY_EMAIL") ?: "";
$subjectText = '乡桥官网新申请：' . $role . '｜' . $county;
$subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';
$body = "申请编号：{$reference}\n身份：{$role}\n联系人：{$name}\n联系电话：{$phone}\n所在县域：{$area}\n合作需求：{$need}\n提交时间：{$record['submittedAt']}\n";
$headers = [
    'From: Xiangqiao Website <configure@example.invalid>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
$emailEnabled = filter_var(getenv('XIANGQIAO_EMAIL_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN);
$emailSent = $emailEnabled && function_exists('mail') && @mail($recipient, $subject, $body, implode("\r\n", $headers));

respond(200, [
    'ok' => true,
    'emailSent' => $emailSent,
    'reference' => $reference,
]);
