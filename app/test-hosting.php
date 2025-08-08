<?php
// test-hosting.php - Verificar capacidades del hosting
echo "<h2>Test de Capacidades del Hosting</h2>";

// Versión PHP
echo "<p><strong>PHP Version:</strong> " . phpversion() . "</p>";

// Funciones necesarias
$required_functions = [
    'mail', 'filter_var', 'hash', 'session_start', 
    'file_put_contents', 'json_encode', 'curl_init'
];

echo "<h3>Funciones Requeridas:</h3>";
foreach ($required_functions as $func) {
    $status = function_exists($func) ? "✅ Disponible" : "❌ No disponible";
    echo "<p><strong>$func:</strong> $status</p>";
}

// Permisos de escritura
$log_dir = './logs';
if (!file_exists($log_dir)) {
    $mkdir_result = @mkdir($log_dir, 0755, true);
    echo "<p><strong>Crear directorio logs:</strong> " . ($mkdir_result ? "✅ Exitoso" : "❌ Falló") . "</p>";
}

$writable = is_writable($log_dir);
echo "<p><strong>Permisos escritura logs:</strong> " . ($writable ? "✅ Sí" : "❌ No") . "</p>";

// Test de mail (opcional)
echo "<h3>Configuración Mail:</h3>";
echo "<p><strong>sendmail_path:</strong> " . ini_get('sendmail_path') . "</p>";
echo "<p><strong>SMTP:</strong> " . ini_get('SMTP') . "</p>";
echo "<p><strong>smtp_port:</strong> " . ini_get('smtp_port') . "</p>";

// Variables de servidor útiles
echo "<h3>Info del Servidor:</h3>";
echo "<p><strong>SERVER_SOFTWARE:</strong> " . ($_SERVER['SERVER_SOFTWARE'] ?? 'No disponible') . "</p>";
echo "<p><strong>DOCUMENT_ROOT:</strong> " . ($_SERVER['DOCUMENT_ROOT'] ?? 'No disponible') . "</p>";
?>