<?php
// assets/php/security.php - Funciones de seguridad (FINAL CORREGIDO)
if (!defined('CONTACT_SYSTEM')) {
    die('Acceso directo no permitido');
}

class ContactSecurity {
    
    /**
     * Genera token CSRF seguro
     */
    public static function generateCSRFToken() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $token = bin2hex(random_bytes(32));                   // Token aleatorio de 64 hex chars
        $_SESSION['csrf_token']    = $token;                  // Lo guardamos en la sesión
        $_SESSION['csrf_time']     = time();                  // Timestamp de creación del token
        $_SESSION['form_start_time'] = time();                // Timestamp de carga del formulario
        return $token;                                        // Devolvemos el token
    }
    
    /**
     * Valida token CSRF
     */
    public static function validateCSRFToken($token) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        if (!isset($_SESSION['csrf_token']) || !isset($_SESSION['csrf_time'])) {
            return false;
        }
        
        // Verificar expiración del token
        if (time() - $_SESSION['csrf_time'] > CSRF_TOKEN_LIFETIME) {
            unset($_SESSION['csrf_token'], $_SESSION['csrf_time']);
            return false;
        }
        
        // Verificar token
        if (!hash_equals($_SESSION['csrf_token'], $token)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Rate limiting por IP (MEJORADO)
     */
    public static function checkRateLimit($ip) {
        $log_file = LOG_FILE;
        
        if (!file_exists($log_file)) {
            return true; // Primera vez
        }
        
        $now = time();
        $hour_ago = $now - 3600;
        $day_ago = $now - 86400;
        
        $lines = file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        $hour_count = 0;
        $day_count = 0;
        
        foreach ($lines as $line) {
            $data = json_decode($line, true);
            if (!$data || !isset($data['ip']) || $data['ip'] !== $ip) continue;
            
            // Solo contar eventos de envío exitoso o intentos fallidos por spam/validación
            if (!isset($data['type']) || 
                !in_array($data['type'], ['EMAIL_SENT', 'VALIDATION_FAILED', 'SPAM_DETECTED'])) {
                continue;
            }
            
            $log_time = strtotime($data['timestamp']);
            
            if ($log_time > $hour_ago) {
                $hour_count++;
            }
            if ($log_time > $day_ago) {
                $day_count++;
            }
        }
        
        return ($hour_count < MAX_REQUESTS_PER_HOUR && $day_count < MAX_REQUESTS_PER_DAY);
    }
    
    /**
     * Sanitiza y valida datos de entrada
     */
    public static function sanitizeInput($data) {
        $data = trim($data);
        $data = stripslashes($data);
        $data = htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
        return $data;
    }
    
    /**
     * Valida email con verificación avanzada (CORREGIDO)
     */
    public static function validateEmail($email) {
        // Validación básica de formato
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }
        
        // Validación de longitud
        if (strlen($email) > 254) {
            return false;
        }
        
        // Extraer dominio
        $domain = substr(strrchr($email, "@"), 1);
        if (!$domain) {
            return false;
        }
        
        // Verificar dominios sospechosos usando la clase SpamConfig
        $suspicious_domains = SpamConfig::getSuspiciousDomains();
        if (in_array(strtolower($domain), $suspicious_domains)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Detecta contenido spam (CORREGIDO)
     */
    public static function detectSpam($text) {
        $spam_keywords = SpamConfig::getSpamKeywords();
        $text_lower = strtolower($text);
        
        // Verificar palabras spam
        foreach ($spam_keywords as $keyword) {
            if (strpos($text_lower, $keyword) !== false) {
                return true;
            }
        }
        
        // Verificar patrones regex
        $spam_patterns = SpamConfig::getSpamPatterns();
        foreach ($spam_patterns as $pattern) {
            if (preg_match($pattern, $text)) {
                return true;
            }
        }
        
        // Detectar exceso de enlaces
        $link_count = preg_match_all('/https?:\/\//', $text);
        if ($link_count > 2) {
            return true;
        }
        
        // Detectar repetición excesiva de caracteres
        if (preg_match('/(.)\1{10,}/', $text)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Detecta bots simples (MEJORADO)
     */
    public static function detectBot() {
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        // Si no hay user agent, probablemente es un bot
        if (empty($user_agent)) {
            return true;
        }
        
        // Verificar user agents sospechosos
        $suspicious_agents = SpamConfig::getSuspiciousUserAgents();
        $user_agent_lower = strtolower($user_agent);
        
        foreach ($suspicious_agents as $agent) {
            if (strpos($user_agent_lower, $agent) !== false) {
                return true;
            }
        }
        
        // Verificar patrones de bot
        $bot_patterns = [
            '/bot/i', '/crawler/i', '/spider/i', '/scraper/i'
        ];
        
        foreach ($bot_patterns as $pattern) {
            if (preg_match($pattern, $user_agent)) {
                return true;
            }
        }
        
              
        // Verificar tiempo de envío (muy rápido = probablemente bot)
        if (isset($_SESSION['form_start_time'])) {            // Si guardamos cuándo se cargó el form…
            $time_diff = time() - $_SESSION['form_start_time'];  // …calculamos la diferencia
            if ($time_diff < HONEYPOT_TIME_THRESHOLD) {          // Si es menor al umbral (config.php)…
                return true;                                     // …lo consideramos bot
            }
        }

        return false;
    }
    
    /**
     * Registra evento en log (MEJORADO)
     */
    public static function logEvent($type, $data) {
        // Crear directorio de logs si no existe
        $log_dir = dirname(LOG_FILE);
        if (!file_exists($log_dir)) {
            mkdir($log_dir, 0755, true);
        }
        
        $log_entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'type' => $type,
            'data' => $data
        ];
        
        $log_line = json_encode($log_entry) . "\n";
        
        // Verificar tamaño del log
        if (file_exists(LOG_FILE) && filesize(LOG_FILE) > LOG_MAX_SIZE) {
            // Rotar log (mantener últimas 1000 líneas)
            $lines = file(LOG_FILE);
            if ($lines) {
                $lines = array_slice($lines, -1000);
                file_put_contents(LOG_FILE, implode('', $lines));
            }
        }
        
        file_put_contents(LOG_FILE, $log_line, FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Aplica headers de seguridad (CORREGIDO)
     */
    public static function setSecurityHeaders() {
        $security_headers = SECURITY_HEADERS;
        
        foreach ($security_headers as $header) {
            header($header);
        }
    }
    
    /**
     * Validación de nombre (REGEX CORREGIDA)
     */
    public static function validateName($name) {
        // Longitud
        if (empty($name) || strlen($name) < 2 || strlen($name) > MAX_NAME_LENGTH) {
            return false;
        }
        
        // Solo letras, espacios y caracteres acentuados (REGEX CORREGIDA)
        // Permitir letras unicode, espacios, apóstrofes y guiones
        if (!preg_match('/^[\p{L}\s\'\-]+$/u', $name)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Validación adicional de mensaje
     */
    public static function validateMessage($message) {
        if (empty($message) || 
            strlen($message) < MIN_MESSAGE_LENGTH || 
            strlen($message) > MAX_MESSAGE_LENGTH) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Validación adicional de asunto
     */
    public static function validateSubject($subject) {
        if (empty($subject) || 
            strlen($subject) < 3 || 
            strlen($subject) > MAX_SUBJECT_LENGTH) {
            return false;
        }
        
        return true;
    }
}
?>