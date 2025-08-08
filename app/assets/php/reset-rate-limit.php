<?php
// reset-rate-limit.php - Resetear rate limiting para testing
define('CONTACT_SYSTEM', true);

$log_file = __DIR__ . '/logs/contact.log';

if (file_exists($log_file)) {
    // Hacer backup del log actual
    $backup_file = __DIR__ . '/logs/contact_backup_' . date('Y-m-d_H-i-s') . '.log';
    copy($log_file, $backup_file);
    
    // Limpiar el log principal
    file_put_contents($log_file, '');
    
    echo "<h2>✅ Rate Limiting Reseteado</h2>";
    echo "<p>Log original respaldado en: " . basename($backup_file) . "</p>";
    echo "<p>Ahora puedes probar el formulario nuevamente.</p>";
} else {
    echo "<h2>ℹ️ No hay logs que resetear</h2>";
}

// También limpiar sessions
session_start();
session_destroy();
echo "<p>✅ Sesiones limpiadas</p>";

echo "<p><strong>Puedes volver a probar el formulario ahora.</strong></p>";
?>