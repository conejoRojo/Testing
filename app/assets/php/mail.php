<?php
// assets/php/mail.php - Endpoint principal con debugging
define('CONTACT_SYSTEM', true);

require_once 'config.php';
require_once 'security.php';

// Función de debug
function debugLog($message, $data = []) {
    $debug_entry = [
        'time' => date('Y-m-d H:i:s'),
        'message' => $message,
        'data' => $data
    ];
    
    $debug_dir = __DIR__ . '/logs';
    if (!file_exists($debug_dir)) {
        mkdir($debug_dir, 0755, true);
    }
    
    file_put_contents($debug_dir . '/debug.log', 
        json_encode($debug_entry) . "\n", 
        FILE_APPEND | LOCK_EX);
}

// Aplicar headers de seguridad
ContactSecurity::setSecurityHeaders();

debugLog('Inicio del proceso', ['method' => $_SERVER['REQUEST_METHOD']]);

// Solo permitir método POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['success' => false, 'message' => 'Método no permitido']));
}

// Validación de Content-Type más flexible
$content_type = $_SERVER['CONTENT_TYPE'] ?? '';
debugLog('Content-Type recibido', ['content_type' => $content_type]);

$valid_content_types = [
    'application/x-www-form-urlencoded',
    'multipart/form-data'
];

$is_valid_content_type = false;
foreach ($valid_content_types as $valid_type) {
    if (strpos($content_type, $valid_type) !== false) {
        $is_valid_content_type = true;
        break;
    }
}

// Solo rechazar JSON explícitamente
if (!empty($content_type) && !$is_valid_content_type && 
    strpos($content_type, 'application/json') !== false) {
    debugLog('Content-Type rechazado', ['content_type' => $content_type]);
    http_response_code(400);
    die(json_encode(['success' => false, 'message' => 'Tipo de contenido no soportado']));
}

try {
    session_start();
    
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    debugLog('IP detectada', ['ip' => $ip]);
    
    // Verificar rate limiting
    if (!ContactSecurity::checkRateLimit($ip)) {
        debugLog('Rate limit excedido', ['ip' => $ip]);
        ContactSecurity::logEvent('RATE_LIMIT_EXCEEDED', ['ip' => $ip]);
        http_response_code(429);
        die(json_encode(['success' => false, 'message' => 'Demasiadas solicitudes. Intente más tarde.']));
    }
    
    // Detectar bots
    if (ContactSecurity::detectBot()) {
        debugLog('Bot detectado', ['ip' => $ip, 'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '']);
        ContactSecurity::logEvent('BOT_DETECTED', ['ip' => $ip, 'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '']);
        http_response_code(403);
        die(json_encode(['success' => false, 'message' => 'Solicitud rechazada']));
    }
    
    // Validar token CSRF
    $csrf_token = $_POST['csrf_token'] ?? '';
    debugLog('Validando CSRF', ['token_present' => !empty($csrf_token)]);
    
    if (!ContactSecurity::validateCSRFToken($csrf_token)) {
        debugLog('CSRF validation failed', ['token' => $csrf_token]);
        ContactSecurity::logEvent('CSRF_VALIDATION_FAILED', ['ip' => $ip]);
        http_response_code(403);
        die(json_encode(['success' => false, 'message' => 'Token de seguridad inválido']));
    }
    
    // Honeypot: si el campo oculto viene **con valor**, rechazamos
    $honeypot = $_POST[HONEYPOT_FIELD_NAME] ?? '';                           // Campo oculto anti-bots
    if (!empty($honeypot)) {                                                // Si alguien lo llenó…
        ContactSecurity::logEvent('HONEYPOT_TRIGGERED', ['ip' => $ip]);     // Log
        http_response_code(403);                                            // Forbidden
        die(json_encode([
            'success' => false,
            'message' => 'Solicitud rechazada'
        ]));
    }

    // Obtener datos del formulario (CAMPOS INTERCAMBIADOS CORREGIDOS)
    $name = ContactSecurity::sanitizeInput($_POST['name'] ?? '');
    $phone = ContactSecurity::sanitizeInput($_POST['phone'] ?? '');    
    $email = ContactSecurity::sanitizeInput($_POST['email'] ?? '');   
    $subject = ContactSecurity::sanitizeInput($_POST['subject'] ?? '');
    $message = ContactSecurity::sanitizeInput($_POST['message'] ?? '');
    
    debugLog('Datos recibidos', [
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'subject' => $subject,
        'message_length' => strlen($message)
    ]);
    
    // Validaciones específicas mejoradas
    $errors = [];
    
    // Validar nombre
    if (!ContactSecurity::validateName($name)) {
        $errors[] = 'Nombre inválido - debe tener entre 2 y ' . MAX_NAME_LENGTH . ' caracteres y solo contener letras';
        debugLog('Error validación nombre', ['name' => $name]);
    }
    
    // Validar email
    if (!ContactSecurity::validateEmail($email)) {
        $errors[] = 'Email inválido - verifique el formato';
        debugLog('Error validación email', ['email' => $email]);
    }
    
    // Validar asunto
    if (!ContactSecurity::validateSubject($subject)) {
        $errors[] = 'Asunto inválido - debe tener entre 3 y ' . MAX_SUBJECT_LENGTH . ' caracteres';
        debugLog('Error validación asunto', ['subject' => $subject]);
    }
    
    // Validar mensaje
    if (!ContactSecurity::validateMessage($message)) {
        $errors[] = 'Mensaje inválido - debe tener entre ' . MIN_MESSAGE_LENGTH . ' y ' . MAX_MESSAGE_LENGTH . ' caracteres';
        debugLog('Error validación mensaje', ['message_length' => strlen($message)]);
    }
    
    if (!empty($errors)) {
        debugLog('Errores de validación', ['errors' => $errors]);
        ContactSecurity::logEvent('VALIDATION_FAILED', ['errors' => $errors, 'ip' => $ip]);
        http_response_code(400);
        die(json_encode(['success' => false, 'message' => implode(', ', $errors)]));
    }
    
    // Detectar spam
    $full_text = $name . ' ' . $subject . ' ' . $message;
    if (ContactSecurity::detectSpam($full_text)) {
        debugLog('Spam detectado', ['ip' => $ip, 'name' => $name, 'email' => $email]);
        ContactSecurity::logEvent('SPAM_DETECTED', ['ip' => $ip, 'name' => $name, 'email' => $email]);
        http_response_code(403);
        die(json_encode(['success' => false, 'message' => 'Contenido rechazado por filtros de seguridad']));
    }
    
    // Preparar email
    $mail_subject = MAIL_SUBJECT_PREFIX . $subject;
    $mail_body = "Nueva consulta desde el sitio web de Nutrien\n\n";
    $mail_body .= "Nombre: " . $name . "\n";
    $mail_body .= "Email: " . $email . "\n";
    $mail_body .= "Teléfono: " . $phone . "\n";
    $mail_body .= "Asunto: " . $subject . "\n\n";
    $mail_body .= "Mensaje:\n" . $message . "\n\n";
    $mail_body .= "---\n";
    $mail_body .= "IP: " . $ip . "\n";
    $mail_body .= "Fecha: " . date('Y-m-d H:i:s') . "\n";
    $mail_body .= "User Agent: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'No disponible') . "\n";
    
    // Headers del email
    $safe_email = preg_replace('/[\r\n]+/', '', $email);
    $safe_name  = preg_replace('/[\r\n]+/', '', $name);
    $headers  = "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . $safe_name . " <" . $safe_email . ">\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "X-Mailer: Nutrien Contact System\r\n";
    
    debugLog('Intentando enviar email', ['to' => MAIL_TO, 'subject' => $mail_subject]);
    
    // Enviar email principal
    $mail_sent = mail(MAIL_TO, $mail_subject, $mail_body, $headers);
    
    if (!$mail_sent) {
        debugLog('Error enviando email', ['error' => error_get_last()]);
        throw new Exception('Error al enviar el email');
    }
    
    debugLog('Email enviado exitosamente');
    
    // Enviar copia al administrador si está configurado
    if (SEND_COPY_TO_ADMIN && MAIL_TO !== 'gastiarena@gmail.com') {
        $admin_subject = '[COPIA] ' . $mail_subject;
        mail('gastiarena@gmail.com', $admin_subject, $mail_body, $headers);
        debugLog('Copia enviada al administrador');
    }
    
    // Log exitoso
    ContactSecurity::logEvent('EMAIL_SENT', [
        'name' => $name,
        'email' => $email,
        'subject' => $subject,
        'ip' => $ip
    ]);
    
    // Limpiar token CSRF usado
    unset($_SESSION['csrf_token'], $_SESSION['csrf_time']);
    
    debugLog('Proceso completado exitosamente');
    
    // Respuesta exitosa
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Mensaje enviado correctamente. Te contactaremos pronto.'
    ]);
    
} catch (Exception $e) {
    debugLog('Excepción capturada', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    
    // Log del error
    ContactSecurity::logEvent('ERROR', [
        'message' => $e->getMessage(),
        'ip' => $ip ?? 'unknown'
    ]);
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno del servidor. Intente más tarde.'
    ]);
}
?>