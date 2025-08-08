<?php
// test-config.php - Verificar que la configuración funciona
define('CONTACT_SYSTEM', true);

require_once 'config.php';
require_once 'security.php';

echo "<h2>Test de Configuración del Sistema</h2>";

// Test 1: Verificar constantes
echo "<h3>1. Constantes definidas:</h3>";
$constants = [
    'MAIL_TO', 'MAIL_FROM', 'MAX_REQUESTS_PER_HOUR', 'MAX_REQUESTS_PER_DAY',
    'MIN_MESSAGE_LENGTH', 'MAX_MESSAGE_LENGTH', 'CSRF_TOKEN_LIFETIME'
];

foreach ($constants as $const) {
    $value = defined($const) ? constant($const) : 'NO DEFINIDA';
    echo "<p><strong>$const:</strong> $value</p>";
}

// Test 2: Verificar clase SpamConfig
echo "<h3>2. Clase SpamConfig:</h3>";
if (class_exists('SpamConfig')) {
    echo "<p>✅ Clase SpamConfig existe</p>";
    
    $domains = SpamConfig::getSuspiciousDomains();
    echo "<p><strong>Dominios sospechosos cargados:</strong> " . count($domains) . "</p>";
    
    $keywords = SpamConfig::getSpamKeywords();
    echo "<p><strong>Palabras spam cargadas:</strong> " . count($keywords) . "</p>";
} else {
    echo "<p>❌ Clase SpamConfig NO existe</p>";
}

// Test 3: Verificar clase ContactSecurity
echo "<h3>3. Clase ContactSecurity:</h3>";
if (class_exists('ContactSecurity')) {
    echo "<p>✅ Clase ContactSecurity existe</p>";
    
    // Test validación de email
    $test_emails = [
        'luis@dixer.net' => 'válido',
        'gastiarena@gmail.com' => 'válido',
        'test@10minutemail.com' => 'spam (debería fallar)',
        'invalid-email' => 'inválido (debería fallar)'
    ];
    
    echo "<h4>Test de validación de emails:</h4>";
    foreach ($test_emails as $email => $expected) {
        $result = ContactSecurity::validateEmail($email);
        $status = $result ? "✅ VÁLIDO" : "❌ INVÁLIDO";
        echo "<p><strong>$email</strong>: $status ($expected)</p>";
    }
    
    // Test validación de nombres
    echo "<h4>Test de validación de nombres:</h4>";
    $test_names = [
        'Luis García' => 'válido',
        'María José' => 'válido',
        'A' => 'inválido (muy corto)',
        'John123' => 'inválido (números)',
        '' => 'inválido (vacío)'
    ];
    
    foreach ($test_names as $name => $expected) {
        $result = ContactSecurity::validateName($name);
        $status = $result ? "✅ VÁLIDO" : "❌ INVÁLIDO";
        echo "<p><strong>'$name'</strong>: $status ($expected)</p>";
    }
    
} else {
    echo "<p>❌ Clase ContactSecurity NO existe</p>";
}

// Test 4: Verificar directorio de logs
echo "<h3>4. Sistema de logs:</h3>";
$log_dir = __DIR__ . '/logs';
if (!file_exists($log_dir)) {
    $created = mkdir($log_dir, 0755, true);
    echo "<p>" . ($created ? "✅" : "❌") . " Directorio logs creado</p>";
} else {
    echo "<p>✅ Directorio logs ya existe</p>";
}

$log_file = $log_dir . '/test.log';
$test_content = "Test log entry: " . date('Y-m-d H:i:s') . "\n";
$written = file_put_contents($log_file, $test_content, FILE_APPEND);
echo "<p>" . ($written ? "✅" : "❌") . " Escritura en logs funciona</p>";

// Test 5: Verificar generación de tokens CSRF
echo "<h3>5. Sistema CSRF:</h3>";
session_start();
$token = ContactSecurity::generateCSRFToken();
echo "<p>✅ Token CSRF generado: " . substr($token, 0, 16) . "...</p>";

$is_valid = ContactSecurity::validateCSRFToken($token);
echo "<p>" . ($is_valid ? "✅" : "❌") . " Validación de token CSRF</p>";

echo "<h3>✅ Test completado</h3>";
echo "<p><em>Si todos los tests pasan, el sistema está configurado correctamente.</em></p>";
?>