<?php
// assets/php/get-csrf-token.php - Genera token CSRF para el formulario
define('CONTACT_SYSTEM', true);

require_once 'config.php';
require_once 'security.php';

// Headers de seguridad
ContactSecurity::setSecurityHeaders();
header('Content-Type: application/json');

// Solo permitir GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    die(json_encode(['error' => 'Método no permitido']));
}

try {
    session_start();
    
    // Marcar tiempo de inicio del formulario (para detección de bots)
    $_SESSION['form_start_time'] = time();
    
    // Generar token CSRF
    $token = ContactSecurity::generateCSRFToken();
    
    echo json_encode([
        'success' => true,
        'csrf_token' => $token
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error generando token'
    ]);
}
?>